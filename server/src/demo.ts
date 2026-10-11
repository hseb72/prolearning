import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { z } from 'zod';
import { ROLES } from '../../shared/roles.js';
import type { UserRecord } from './users.js';

const accountsFile = z.object({
  comptes: z
    .array(
      z.object({
        cle: z.string().min(1),
        nom: z.string().min(1),
        email: z.string().email(),
        role: z.enum(ROLES),
        manager: z.string().optional(),
      }),
    )
    .min(1),
});

/** Fichier des comptes fictifs, cherché en remontant depuis ce module (sources ou dist). */
export function demoAccountsFile(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    const candidate = join(dir, 'fixtures', 'demo', 'comptes.json');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Fichier fixtures/demo/comptes.json introuvable.');
}

/**
 * Charge les comptes fictifs dans la base de DÉMONSTRATION si elle n'a encore aucun compte.
 * (La réinitialisation complète de la démo viendra avec l'étape 6.) Renvoie le nombre créé.
 */
export async function ensureDemoAccounts(
  demo: pg.Pool,
  file: string = demoAccountsFile(),
): Promise<number> {
  const { comptes } = accountsFile.parse(JSON.parse(readFileSync(file, 'utf8')));
  const client = await demo.connect();
  try {
    await client.query('BEGIN');
    // Verrou de table : deux répliques qui démarrent ensemble ne chargent pas deux fois.
    await client.query('LOCK TABLE pl_users IN EXCLUSIVE MODE');
    const existing = await client.query('SELECT 1 FROM pl_users LIMIT 1');
    if (existing.rowCount) {
      await client.query('COMMIT');
      return 0;
    }
    const ids = new Map<string, number>();
    for (const compte of comptes) {
      const res = await client.query<{ id: number }>(
        'INSERT INTO pl_users (email, display_name, role) VALUES ($1, $2, $3) RETURNING id::int',
        [compte.email, compte.nom, compte.role],
      );
      ids.set(compte.cle, res.rows[0]!.id);
    }
    for (const compte of comptes) {
      if (!compte.manager) continue;
      const managerId = ids.get(compte.manager);
      if (managerId === undefined) {
        throw new Error(`Compte fictif « ${compte.cle} » : manager « ${compte.manager} » inconnu.`);
      }
      await client.query('UPDATE pl_users SET manager_id = $2 WHERE id = $1', [
        ids.get(compte.cle),
        managerId,
      ]);
    }
    await client.query('COMMIT');
    return comptes.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Compte joué par défaut en démonstration : le premier administrateur fictif. */
export async function findDefaultPersona(demo: pg.Pool): Promise<UserRecord | null> {
  const res = await demo.query<UserRecord>(
    `SELECT id::int AS id, oidc_subject AS "oidcSubject", email, display_name AS "displayName",
            role, manager_id::int AS "managerId", active, last_login_at AS "lastLoginAt"
     FROM pl_users WHERE active AND role = 'admin' ORDER BY id LIMIT 1`,
  );
  return res.rows[0] ?? null;
}
