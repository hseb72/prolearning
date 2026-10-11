import { execFileSync } from 'node:child_process';

/** Les deux bases repartent vides (comptes fictifs de démonstration rechargés). */
export default function globalSetup(): void {
  execFileSync('npm', ['--prefix', 'server', 'run', '--silent', 'e2e:reset'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_DATABASE_URL_PRODUCTION: process.env['E2E_DATABASE_URL_PRODUCTION'],
      TEST_DATABASE_URL_DEMO: process.env['E2E_DATABASE_URL_DEMO'],
    },
  });
}
