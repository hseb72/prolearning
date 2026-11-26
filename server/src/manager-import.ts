import type pg from 'pg';
import { z } from 'zod';
import type {
  ManagerImportLine,
  ManagerImportReport,
  ManagerImportStatus,
} from '../../shared/auth.js';
import { csvCell, parseCsv } from '../../shared/csv.js';
import { hasRole, type Role } from '../../shared/roles.js';
import { audit } from './audit.js';

/** Taille maximale d'un fichier de rattachements. */
export const MAX_IMPORT_LINES = 5000;

/** En-têtes reconnus (minuscules, sans accents ni espaces). */
const COLUMNS: Record<string, 'member' | 'manager' | 'name'> = {
  collaborateur: 'member',
  email: 'member',
  courriel: 'member',
  adresse: 'member',
  manager: 'manager',
  responsable: 'manager',
  nom: 'name',
  name: 'name',
};

const email = z.string().email().max(320);

interface Account {
  id: number;
  email: string;
  role: Role;
  managerId: number | null;
  active: boolean;
}

interface Row {
  line: number;
  member: string;
  manager: string | null;
  name: string;
  status: ManagerImportStatus;
  message?: string;
  previousManager?: string | null;
}

function normalize(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/s$/, '');
}

function emptyReport(fileError: string): ManagerImportReport {
  return {
    applied: false,
    lines: [],
    promoted: [],
    counts: { created: 0, updated: 0, unchanged: 0, error: 0 },
    fileError,
  };
}

/**
 * Importe les rattachements collaborateur → manager d'un fichier CSV dans la base d'un
 * espace. Tout ou rien : la vérification produit le rapport ligne par ligne, et
 * l'application n'a lieu que si aucune ligne n'est en erreur.
 *
 * - Un collaborateur inconnu reçoit un compte (rôle collaborateur), rattaché à son
 *   identité Keycloak à sa première connexion, par son adresse.
 * - Le manager doit être un compte actif, existant ou créé par une autre ligne du fichier ;
 *   un simple collaborateur qui reçoit une équipe devient manager.
 * - Une case manager vide retire le rattachement. Une boucle (A manager de B, B de A) est
 *   refusée. Les comptes absents du fichier ne changent pas.
 */
export async function importManagers(
  db: pg.Pool,
  text: string,
  apply: boolean,
  actor: { actorId: number; actorLabel: string },
): Promise<ManagerImportReport> {
  const parsed = parseCsv(text);
  const [header, ...body] = parsed;
  if (!header) return emptyReport('Le fichier est vide.');
  if (body.length > MAX_IMPORT_LINES) {
    return emptyReport(`Le fichier dépasse ${MAX_IMPORT_LINES} lignes.`);
  }
  const index: Partial<Record<'member' | 'manager' | 'name', number>> = {};
  header.cells.forEach((cell, i) => {
    const column = COLUMNS[normalize(cell)];
    if (column && index[column] === undefined) index[column] = i;
  });
  if (index.member === undefined || index.manager === undefined) {
    return emptyReport(
      'La première ligne doit nommer les colonnes « collaborateur » et « manager » (et, si besoin, « nom »).',
    );
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Pas de modification concurrente des comptes pendant l'import.
    await client.query('LOCK TABLE pl_users IN SHARE ROW EXCLUSIVE MODE');
    const existing = await client.query<Account>(
      `SELECT id::int, email, role, manager_id::int AS "managerId", active FROM pl_users`,
    );
    const byEmail = new Map(existing.rows.map((a) => [a.email.toLowerCase(), a]));
    const emailById = new Map(existing.rows.map((a) => [a.id, a.email]));

    // 1. Lecture et contrôles de chaque ligne.
    const seen = new Map<string, number>();
    const rows: Row[] = body.map(({ line, cells }) => {
      const member = (cells[index.member!] ?? '').toLowerCase();
      const managerCell = (cells[index.manager!] ?? '').toLowerCase();
      const row: Row = {
        line,
        member,
        manager: managerCell || null,
        name: index.name !== undefined ? (cells[index.name] ?? '') : '',
        status: 'unchanged',
      };
      const fail = (message: string): Row => ({ ...row, status: 'error', message });
      if (!member) return fail('Adresse du collaborateur manquante.');
      if (!email.safeParse(member).success) return fail(`Adresse invalide : ${member}.`);
      if (row.manager && !email.safeParse(row.manager).success) {
        return fail(`Adresse du manager invalide : ${row.manager}.`);
      }
      if (row.manager === member) return fail('Un compte ne peut pas être son propre manager.');
      const first = seen.get(member);
      if (first !== undefined) return fail(`Collaborateur déjà présent ligne ${first}.`);
      seen.set(member, line);
      const account = byEmail.get(member);
      if (account && !account.active) return fail('Ce compte est désactivé.');
      return row;
    });

    // 2. Managers : un compte actif, existant ou créé par une ligne du fichier.
    const created = new Set(
      rows.filter((r) => r.status !== 'error' && !byEmail.has(r.member)).map((r) => r.member),
    );
    const promoted = new Set<string>();
    for (const row of rows) {
      if (row.status === 'error' || !row.manager) continue;
      const manager = byEmail.get(row.manager);
      if (!manager && !created.has(row.manager)) {
        row.status = 'error';
        row.message = `Manager inconnu : ${row.manager}. Ajoutez-lui une ligne, ou attendez sa première connexion.`;
      } else if (manager && !manager.active) {
        row.status = 'error';
        row.message = `Le compte du manager ${row.manager} est désactivé.`;
      } else if (!manager || !hasRole(manager.role, 'manager')) {
        promoted.add(row.manager);
      }
    }

    // 3. Rattachements après import : pas de boucle.
    const managerOf = new Map<string, string | null>(
      existing.rows.map((a) => [
        a.email.toLowerCase(),
        a.managerId === null ? null : (emailById.get(a.managerId)?.toLowerCase() ?? null),
      ]),
    );
    for (const row of rows) if (row.status !== 'error') managerOf.set(row.member, row.manager);
    for (const row of rows) {
      if (row.status === 'error' || !row.manager) continue;
      const visited = new Set<string>([row.member]);
      let current: string | null | undefined = row.manager;
      while (current) {
        if (visited.has(current)) {
          row.status = 'error';
          row.message = `Rattachement en boucle : ${row.member} se retrouverait sous sa propre autorité.`;
          break;
        }
        visited.add(current);
        current = managerOf.get(current);
      }
    }

    // 4. Issue de chaque ligne valide.
    for (const row of rows) {
      if (row.status === 'error') continue;
      const account = byEmail.get(row.member);
      if (!account) {
        row.status = 'created';
        continue;
      }
      const previous =
        account.managerId === null
          ? null
          : (emailById.get(account.managerId)?.toLowerCase() ?? null);
      if (previous !== row.manager) {
        row.status = 'updated';
        row.previousManager = previous;
      }
    }

    const counts = { created: 0, updated: 0, unchanged: 0, error: 0 };
    for (const row of rows) counts[row.status]++;
    const canApply = apply && counts.error === 0;

    if (canApply) {
      const ids = new Map(existing.rows.map((a) => [a.email.toLowerCase(), a.id]));
      for (const row of rows.filter((r) => r.status === 'created')) {
        const res = await client.query<{ id: number }>(
          `INSERT INTO pl_users (email, display_name) VALUES ($1, $2) RETURNING id::int`,
          [row.member, row.name || row.member.split('@')[0]],
        );
        ids.set(row.member, res.rows[0]!.id);
      }
      for (const address of promoted) {
        const id = ids.get(address)!;
        const from = byEmail.get(address)?.role ?? 'employee';
        await client.query(`UPDATE pl_users SET role = 'manager' WHERE id = $1`, [id]);
        await audit(client, {
          ...actor,
          action: 'user.role',
          details: { userId: id, from, to: 'manager' },
        });
      }
      for (const row of rows.filter((r) => r.status === 'created' || r.status === 'updated')) {
        const id = ids.get(row.member)!;
        const to = row.manager ? ids.get(row.manager)! : null;
        if (row.status === 'created' && to === null) continue;
        await client.query('UPDATE pl_users SET manager_id = $2 WHERE id = $1', [id, to]);
        const account = byEmail.get(row.member);
        await audit(client, {
          ...actor,
          action: 'user.manager',
          details: { userId: id, from: account?.managerId ?? null, to },
        });
      }
      await audit(client, {
        ...actor,
        action: 'user.import',
        details: {
          lignes: rows.length,
          crees: counts.created,
          modifies: counts.updated,
          promus: promoted.size,
        },
      });
    }
    await client.query(canApply ? 'COMMIT' : 'ROLLBACK');

    return {
      applied: canApply,
      lines: rows.map((r): ManagerImportLine => ({
        line: r.line,
        member: r.member,
        manager: r.manager,
        status: r.status,
        ...(r.previousManager !== undefined ? { previousManager: r.previousManager } : {}),
        ...(r.message ? { message: r.message } : {}),
      })),
      promoted: counts.error === 0 ? [...promoted] : [],
      counts,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Rattachements actuels, au format de l'import : un modèle à compléter. */
export async function exportManagers(db: pg.Pool): Promise<string> {
  const res = await db.query<{ email: string; name: string; manager: string | null }>(
    `SELECT u.email, u.display_name AS name, m.email AS manager
       FROM pl_users u LEFT JOIN pl_users m ON m.id = u.manager_id
      WHERE u.active ORDER BY lower(u.display_name), u.id`,
  );
  const lines = [
    'collaborateur;nom;manager',
    ...res.rows.map((r) => [r.email, r.name, r.manager ?? ''].map(csvCell).join(';')),
  ];
  // Marque d'ordre d'octets : Excel ouvre ainsi le fichier en UTF-8.
  return `﻿${lines.join('\r\n')}\r\n`;
}
