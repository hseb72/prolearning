import pg from 'pg';
import { SPACES, type Space } from '../../shared/spaces.js';
import type { Config } from './config.js';

/**
 * Une connexion (pool) par espace. C'est le SEUL module qui ouvre une connexion à
 * une base : le reste du code reçoit le pool de l'espace de la requête, jamais les deux.
 */
export type Databases = Readonly<Record<Space, pg.Pool>>;

const URL_KEYS: Record<Space, 'DATABASE_URL_PRODUCTION' | 'DATABASE_URL_DEMO'> = {
  production: 'DATABASE_URL_PRODUCTION',
  demo: 'DATABASE_URL_DEMO',
};

export function createDatabases(config: Config): Databases {
  const entries = SPACES.map((space) => {
    const pool = new pg.Pool({
      connectionString: config[URL_KEYS[space]],
      application_name: `prolearning-${space}`,
      max: 10,
    });
    // Une connexion inactive qui tombe (redémarrage de PostgreSQL) ne doit pas arrêter l'API.
    pool.on('error', (err) => console.error(`Base ${space} : connexion perdue`, err.message));
    return [space, pool] as const;
  });
  return Object.freeze(Object.fromEntries(entries) as Record<Space, pg.Pool>);
}

export async function closeDatabases(databases: Databases): Promise<void> {
  await Promise.all(SPACES.map((space) => databases[space].end()));
}
