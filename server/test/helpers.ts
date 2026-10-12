import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import type { AuthSettings } from '../src/auth/routes.js';
import type { Databases } from '../src/databases.js';
import { ensureDemoAccounts } from '../src/demo.js';
import { migrateAll } from '../src/migrate.js';

export const APP_URL = 'http://localhost:4200';
export const BOOTSTRAP_ADMIN = 'admin@soredi.example';

/** Réglages d'authentification des tests : connexion de développement, sans SSO. */
export const AUTH: AuthSettings = {
  appUrl: APP_URL,
  sessionDays: 7,
  devLogin: true,
  bootstrapAdmins: [BOOTSTRAP_ADMIN],
  oidc: null,
};

// Tests d'intégration sur deux vraies bases PostgreSQL, comme en production.
// En CI, leur absence est une erreur ; en local, ils sont sautés avec un avertissement.
const urls = {
  production: process.env['TEST_DATABASE_URL_PRODUCTION'],
  demo: process.env['TEST_DATABASE_URL_DEMO'],
};
export const databasesAvailable = Boolean(urls.production && urls.demo);
if (!databasesAvailable && process.env['CI']) {
  throw new Error('TEST_DATABASE_URL_PRODUCTION et TEST_DATABASE_URL_DEMO sont requis en CI.');
}

export function openTestDatabases(): Databases {
  return {
    production: new pg.Pool({ connectionString: urls.production }),
    demo: new pg.Pool({ connectionString: urls.demo }),
  };
}

/** Schéma à jour, tables vidées, comptes fictifs rechargés en démonstration. */
export async function resetDatabases(databases: Databases): Promise<void> {
  await migrateAll(databases);
  for (const db of [databases.production, databases.demo]) {
    await db.query(
      'TRUNCATE pl_formation_versions, pl_formations, pl_audit_log, pl_sessions, pl_oidc_requests, pl_users RESTART IDENTITY CASCADE',
    );
  }
  await ensureDemoAccounts(databases.demo);
}

export async function closeTestDatabases(databases: Databases): Promise<void> {
  await Promise.all([databases.production.end(), databases.demo.end()]);
}

export function testApp(databases: Databases, auth: Partial<AuthSettings> = {}): FastifyInstance {
  return buildApp({ databases, logLevel: 'silent', auth: { ...AUTH, ...auth } });
}

/** Connexion de développement ; renvoie l'en-tête Cookie à rejouer. */
export async function login(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/dev-login', payload: { email } });
  if (res.statusCode !== 204)
    throw new Error(`Connexion refusée (${res.statusCode}) : ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === 'pl_session');
  if (!cookie) throw new Error('Aucun cookie de session.');
  return `pl_session=${cookie.value}`;
}

export async function promote(databases: Databases, email: string, role: string): Promise<void> {
  await databases.production.query('UPDATE pl_users SET role = $2 WHERE lower(email) = $1', [
    email.toLowerCase(),
    role,
  ]);
}
