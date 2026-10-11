import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { SPACES, type Space } from '../../shared/spaces.js';
import type { Databases } from './databases.js';

/** Identifiant arbitraire du verrou consultatif des migrations (« PL » en ASCII). */
const MIGRATION_LOCK = 0x504c;

/** Dossier db/migrations du dépôt, cherché en remontant depuis ce fichier (sources ou dist). */
export function migrationsDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    const candidate = join(dir, 'db', 'migrations');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error('Dossier db/migrations introuvable.');
}

/**
 * Applique, dans l'ordre alphabétique, les scripts .sql pas encore passés sur cette base.
 * Chaque script s'exécute dans sa propre transaction. Renvoie les noms appliqués.
 */
export async function migrate(pool: pg.Pool, dir: string = migrationsDir()): Promise<string[]> {
  // Plusieurs répliques de l'API démarrent en même temps : un verrou consultatif
  // garantit qu'une seule applique les migrations, les autres attendent puis constatent.
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await client.query(`CREATE TABLE IF NOT EXISTS pl_migrations (
      name       varchar(255) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM pl_migrations')).rows.map(
        (row) => row.name,
      ),
    );
    const pending = readdirSync(dir)
      .filter((file) => file.endsWith('.sql') && !done.has(file))
      .sort();
    for (const file of pending) {
      const sql = readFileSync(join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO pl_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} en échec : ${(err as Error).message}`, { cause: err });
      }
    }
    return pending;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => undefined);
    client.release();
  }
}

/** Applique les migrations à la base de chaque espace : les deux schémas restent identiques. */
export async function migrateAll(
  databases: Databases,
  dir?: string,
): Promise<Record<Space, string[]>> {
  const result = {} as Record<Space, string[]>;
  for (const space of SPACES) {
    try {
      result[space] = await migrate(databases[space], dir);
    } catch (err) {
      throw new Error(`Base ${space} : ${(err as Error).message}`, { cause: err });
    }
  }
  return result;
}
