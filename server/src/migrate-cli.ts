// Applique les migrations aux trois bases (production, démonstration, évaluation) puis s'arrête (usage : npm run migrate).
import { loadConfig } from './config.js';
import { closeDatabases, createDatabases } from './databases.js';
import { migrateAll } from './migrate.js';

const databases = createDatabases(loadConfig());
try {
  const applied = await migrateAll(databases);
  for (const [space, names] of Object.entries(applied)) {
    console.log(`Base ${space} : ${names.length ? names.join(', ') : 'à jour'}`);
  }
} finally {
  await closeDatabases(databases);
}
