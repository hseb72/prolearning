import pg from 'pg';
import { DATABASE_NAMES, type DatabaseName } from '../../shared/spaces.js';
import type { Config } from './config.js';

/**
 * Une connexion (pool) par base : production, démonstration, évaluation. C'est le SEUL
 * module qui ouvre une connexion : le code métier reçoit le pool de l'espace de la
 * requête, jamais les autres.
 */
export type Databases = Readonly<Record<DatabaseName, pg.Pool>>;

const URL_KEYS = {
  production: 'DATABASE_URL_PRODUCTION',
  demo: 'DATABASE_URL_DEMO',
  evaluation: 'DATABASE_URL_EVALUATION',
} as const satisfies Record<DatabaseName, string>;

export function createDatabases(config: Config): Databases {
  const entries = DATABASE_NAMES.map((space) => {
    const pool = new pg.Pool({
      connectionString: config[URL_KEYS[space]],
      application_name: `prolearning-${space}`,
      max: 10,
    });
    // Une connexion inactive qui tombe (redémarrage de PostgreSQL) ne doit pas arrêter l'API.
    pool.on('error', (err) => console.error(`Base ${space} : connexion perdue`, err.message));
    return [space, pool] as const;
  });
  return Object.freeze(Object.fromEntries(entries) as Record<DatabaseName, pg.Pool>);
}

export async function closeDatabases(databases: Databases): Promise<void> {
  await Promise.all(DATABASE_NAMES.map((space) => databases[space].end()));
}
