// Remise à zéro des deux bases avant les tests de bout en bout (npm run e2e).
import { closeTestDatabases, openTestDatabases, resetDatabases } from './helpers.js';

const databases = openTestDatabases();
try {
  await resetDatabases(databases);
  console.log('Bases de bout en bout remises à zéro.');
} finally {
  await closeTestDatabases(databases);
}
