// Remise à zéro des deux bases avant les tests de bout en bout (npm run e2e).
import { loadDemo } from '../src/demo.js';
import { closeTestDatabases, openTestDatabases, resetDatabases } from './helpers.js';

const databases = openTestDatabases();
try {
  await resetDatabases(databases);
  // Démonstration complète, comme en production : comptes, formations, catalogue, demandes.
  await loadDemo(databases.demo);
  console.log('Bases de bout en bout remises à zéro.');
} finally {
  await closeTestDatabases(databases);
}
