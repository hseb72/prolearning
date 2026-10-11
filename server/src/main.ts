import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { closeDatabases, createDatabases } from './databases.js';
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

const app = buildApp({ databases, logLevel: config.LOG_LEVEL });

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} reçu : arrêt en cours`);
  await app.close();
  await closeDatabases(databases);
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: config.HOST, port: config.PORT });
