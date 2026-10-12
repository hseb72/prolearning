import { buildApp } from './app.js';
import { OidcLogin } from './auth/oidc.js';
import { purgeExpired } from './auth/sessions.js';
import { loadConfig } from './config.js';
import { closeDatabases, createDatabases } from './databases.js';
import { loadDemo } from './demo.js';
import { migrateAll } from './migrate.js';

const config = loadConfig();
const databases = createDatabases(config);

const applied = await migrateAll(databases);
for (const [space, names] of Object.entries(applied)) {
  console.log(
    names.length
      ? `Base ${space} : migrations appliquées — ${names.join(', ')}`
      : `Base ${space} : aucune migration à appliquer`,
  );
}
// Base démo vide (premier démarrage) : chargement du jeu de démonstration.
const loaded = await loadDemo(databases.demo, { onlyIfEmpty: true });
if (loaded) {
  console.log(
    `Base demo : jeu chargé — ${loaded.comptes} comptes, ${loaded.formations} formations, ${loaded.fiches} fiches, ${loaded.sessions} sessions, ${loaded.demandes} demandes`,
  );
}

const app = buildApp({
  databases,
  logLevel: config.LOG_LEVEL,
  auth: {
    appUrl: config.APP_URL,
    sessionDays: config.SESSION_DAYS,
    devLogin: config.AUTH_DEV_LOGIN,
    bootstrapAdmins: config.BOOTSTRAP_ADMIN_EMAILS,
    oidc: config.oidc
      ? new OidcLogin(config.oidc, new URL('/api/auth/callback', config.APP_URL).href, {
          allowInsecureIssuer: config.NODE_ENV !== 'production',
        })
      : null,
  },
});

// Sessions et connexions expirées : purgées toutes les heures (minimisation des données).
const purge = setInterval(
  () =>
    void purgeExpired(databases.production).catch((err) => app.log.warn({ err }, 'Purge en échec')),
  3600_000,
);
purge.unref();

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} reçu : arrêt en cours`);
  clearInterval(purge);
  await app.close();
  await closeDatabases(databases);
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: config.HOST, port: config.PORT });
