import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { z } from 'zod';
import { COURSE_ID_PATTERN, MODALITES } from '../../shared/catalog.js';
import { parisLocalToIso } from '../../shared/paris-time.js';
import { CUSTOM_STATUSES, REGISTRATION_STATUSES } from '../../shared/requests.js';
import { ROLES } from '../../shared/roles.js';
import { storeFormation } from './format/store.js';
import { validateFormation } from './format/validate.js';
import type { UserRecord } from './users.js';

/**
 * Espace démonstration : chargement du jeu de `fixtures/` (comptes fictifs, formations en
 * ligne, catalogue, sessions, demandes) et réinitialisation. Ne touche que la base qu'on
 * lui passe — celle de la démonstration.
 */

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

const moment = z.object({ jour: z.number().int(), heure: z.string().regex(/^\d{2}:\d{2}$/) });
const step = (statuts: readonly [string, ...string[]]) =>
  z.object({ statut: z.enum(statuts), par: z.string(), commentaire: z.string().default('') });

const dataFile = z.object({
  fiches: z.array(
    z.object({
      id: z.string().regex(COURSE_ID_PATTERN),
      titre: z.string().min(1),
      theme: z.string().min(1),
      resume: z.string().min(1),
      objectifs: z.array(z.string()).default([]),
      public: z.string().default(''),
      prerequis: z.string().default(''),
      dureeHeures: z.number().positive().nullable().default(null),
      formation: z.string().optional(),
      publiee: z.boolean(),
    }),
  ),
  sessions: z.array(
    z.object({
      cle: z.string().min(1),
      fiche: z.string(),
      modalite: z.enum(MODALITES),
      debut: moment,
      fin: moment,
      lieu: z.string().default(''),
      formateur: z.string().default(''),
      places: z.number().int().positive(),
      annulee: z.boolean().default(false),
    }),
  ),
  inscriptions: z.array(
    z.object({
      compte: z.string(),
      session: z.string(),
      motif: z.string().default(''),
      etapes: z.array(step(REGISTRATION_STATUSES)).default([]),
    }),
  ),
  surMesure: z.array(
    z.object({
      compte: z.string(),
      fiche: z.string().optional(),
      sujet: z.string().min(1),
      modalite: z.enum(['distance', 'site', 'indifferent']),
      participants: z.number().int().positive(),
      periode: z.string().default(''),
      details: z.string().default(''),
      etapes: z.array(step(CUSTOM_STATUSES)).default([]),
    }),
  ),
});

/** Tables jamais vidées : mécanisme de migration, et tables d'authentification. */
const KEPT_TABLES = new Set(['pl_migrations', 'pl_sessions', 'pl_oidc_requests']);

/** Dossier `fixtures/`, cherché en remontant depuis ce module (sources ou dist). */
export function fixturesDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    const candidate = join(dir, 'fixtures');
    if (existsSync(join(candidate, 'demo', 'comptes.json'))) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Dossier fixtures/ (avec demo/comptes.json) introuvable.');
}

/** Date ISO d'un moment relatif au jour du chargement, à l'heure de Paris. */
function at(m: { jour: number; heure: string }, today: Date): string {
  const d = new Date(today.getTime() + m.jour * 24 * 3600 * 1000);
  return parisLocalToIso(`${d.toISOString().slice(0, 10)}T${m.heure}`);
}

export interface DemoSummary {
  comptes: number;
  formations: number;
  fiches: number;
  sessions: number;
  demandes: number;
}

async function inTransaction<T>(client: pg.PoolClient, work: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try {
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Vide la base de démonstration et recharge le jeu de `fixtures/`. Sérialisé par un verrou
 * consultatif : deux réinitialisations (ou deux répliques au démarrage) ne se croisent pas.
 * Avec `onlyIfEmpty`, ne fait rien si la base a déjà des comptes ; avec `accountsOnly`
 * (tests de l'API), ne charge que les comptes fictifs.
 */
export async function loadDemo(
  demo: pg.Pool,
  options: { onlyIfEmpty?: boolean; accountsOnly?: boolean; dir?: string; today?: Date } = {},
): Promise<DemoSummary | null> {
  const dir = options.dir ?? fixturesDir();
  const today = options.today ?? new Date();
  // Lecture et contrôle des fichiers avant de toucher à la base.
  const { comptes } = accountsFile.parse(
    JSON.parse(readFileSync(join(dir, 'demo', 'comptes.json'), 'utf8')),
  );
  const data = dataFile.parse(JSON.parse(readFileSync(join(dir, 'demo', 'donnees.json'), 'utf8')));
  const formationsDir = join(dir, 'formations');
  const formations = existsSync(formationsDir)
    ? readdirSync(formationsDir)
        .filter((f) => f.endsWith('.formation.json'))
        .sort()
        .map((f) => {
          const source = readFileSync(join(formationsDir, f), 'utf8');
          const report = validateFormation(source);
          if (!report.ok || !report.formation) throw new Error(`Formation de démo invalide : ${f}`);
          const doc = JSON.parse(source) as Record<string, string>;
          return { source, report: report.formation, doc };
        })
    : [];

  const client = await demo.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('pl:demo-load'))");
    try {
      if (options.onlyIfEmpty) {
        const existing = await client.query('SELECT 1 FROM pl_users LIMIT 1');
        if (existing.rowCount) return null;
      }

      // 1. Base vidée, comptes fictifs.
      const accounts = await inTransaction(client, async () => {
        const tables = await client.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
             AND table_name LIKE 'pl\\_%'`,
        );
        const names = tables.rows.map((r) => r.table_name).filter((t) => !KEPT_TABLES.has(t));
        if (names.length) {
          await client.query(`TRUNCATE ${names.join(', ')} RESTART IDENTITY CASCADE`);
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
            throw new Error(
              `Compte fictif « ${compte.cle} » : manager « ${compte.manager} » inconnu.`,
            );
          }
          await client.query('UPDATE pl_users SET manager_id = $2 WHERE id = $1', [
            ids.get(compte.cle),
            managerId,
          ]);
        }
        return ids;
      });
      const names = new Map(comptes.map((c) => [c.cle, c.nom]));
      const account = (cle: string) => {
        const id = accounts.get(cle);
        if (id === undefined) throw new Error(`Compte fictif inconnu : « ${cle} ».`);
        return { id, nom: names.get(cle)! };
      };

      if (options.accountsOnly) {
        return { comptes: comptes.length, formations: 0, fiches: 0, sessions: 0, demandes: 0 };
      }

      // 2. Formations en ligne, importées comme le ferait un administrateur.
      for (const f of formations) {
        await storeFormation(
          demo,
          {
            id: f.report.id,
            version: f.report.version,
            formatVersion: f.doc['formatVersion']!,
            titre: f.doc['titre']!,
            theme: f.doc['theme']!,
            source: f.source,
          },
          {
            allowReplace: true,
            origin: 'import',
            importedBy: null,
            importedByLabel: 'Jeu de démonstration',
          },
        );
      }

      // 3. Catalogue, sessions et demandes.
      await inTransaction(client, async () => {
        for (const c of data.fiches) {
          await client.query(
            `INSERT INTO pl_courses (id, titre, theme, resume, objectifs, public, prerequis,
               duree_heures, formation_id, publiee)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              c.id,
              c.titre,
              c.theme,
              c.resume,
              c.objectifs,
              c.public,
              c.prerequis,
              c.dureeHeures,
              c.formation ?? null,
              c.publiee,
            ],
          );
        }
        const sessions = new Map<string, number>();
        for (const s of data.sessions) {
          const res = await client.query<{ id: string }>(
            `INSERT INTO pl_course_sessions
               (course_id, modalite, debut, fin, lieu, formateur, places, annulee)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
              s.fiche,
              s.modalite,
              at(s.debut, today),
              at(s.fin, today),
              s.lieu,
              s.formateur,
              s.places,
              s.annulee,
            ],
          );
          sessions.set(s.cle, Number(res.rows[0]!.id));
        }
        const event = (
          kind: string,
          id: number,
          statut: string,
          who: { id: number; nom: string },
          commentaire: string,
        ) =>
          client.query(
            `INSERT INTO pl_request_events (kind, request_id, statut, actor_id, actor_name, commentaire)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [kind, id, statut, who.id, who.nom, commentaire],
          );

        for (const r of data.inscriptions) {
          const user = account(r.compte);
          const sessionId = sessions.get(r.session);
          if (sessionId === undefined)
            throw new Error(`Session de démo inconnue : « ${r.session} ».`);
          const statut = r.etapes.at(-1)?.statut ?? 'attente_manager';
          const res = await client.query<{ id: string }>(
            `INSERT INTO pl_registration_requests (session_id, user_id, statut, motif)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [sessionId, user.id, statut, r.motif],
          );
          const id = Number(res.rows[0]!.id);
          await event('inscription', id, 'attente_manager', user, r.motif);
          for (const e of r.etapes)
            await event('inscription', id, e.statut, account(e.par), e.commentaire);
          if (statut === 'confirmee') {
            await client.query(
              `INSERT INTO pl_session_registrations (session_id, user_id, statut)
               VALUES ($1, $2, 'confirmee')`,
              [sessionId, user.id],
            );
          }
        }
        for (const q of data.surMesure) {
          const user = account(q.compte);
          const statut = q.etapes.at(-1)?.statut ?? 'a_traiter';
          const res = await client.query<{ id: string }>(
            `INSERT INTO pl_custom_requests
               (requester_id, course_id, sujet, modalite, participants, periode, details, statut)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
              user.id,
              q.fiche ?? null,
              q.sujet,
              q.modalite,
              q.participants,
              q.periode,
              q.details,
              statut,
            ],
          );
          const id = Number(res.rows[0]!.id);
          await event('sur_mesure', id, 'a_traiter', user, '');
          for (const e of q.etapes)
            await event('sur_mesure', id, e.statut, account(e.par), e.commentaire);
        }
      });

      return {
        comptes: comptes.length,
        formations: formations.length,
        fiches: data.fiches.length,
        sessions: data.sessions.length,
        demandes: data.inscriptions.length + data.surMesure.length,
      };
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('pl:demo-load'))");
    }
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
