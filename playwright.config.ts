import { defineConfig, devices } from '@playwright/test';

// Tests de bout en bout : le front (ng serve, qui relaie /api) et l'API, sur deux
// vraies bases (E2E_DATABASE_URL_PRODUCTION / E2E_DATABASE_URL_DEMO / E2E_DATABASE_URL_EVALUATION).
// PLAYWRIGHT_CHROMIUM_PATH permet d'utiliser un Chromium déjà installé.
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] || undefined;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'bureau', testIgnore: /demo-reset/, use: { ...devices['Desktop Chrome'] } },
    // Exigence transverse : parcours clé utilisable sur un écran de 375 px de large.
    {
      name: 'mobile-375',
      testIgnore: /demo-reset/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    // La réinitialisation de la démonstration remplace toute la base démo : elle passe
    // seule, après les autres tests, qui utilisent aussi cet espace.
    {
      name: 'demonstration',
      testMatch: /demo-reset/,
      dependencies: ['bureau', 'mobile-375'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix server run dev',
      url: 'http://localhost:5080/api/health',
      reuseExistingServer: !process.env['CI'],
      env: {
        DATABASE_URL_PRODUCTION: process.env['E2E_DATABASE_URL_PRODUCTION'] ?? '',
        DATABASE_URL_DEMO: process.env['E2E_DATABASE_URL_DEMO'] ?? '',
        DATABASE_URL_EVALUATION: process.env['E2E_DATABASE_URL_EVALUATION'] ?? '',
        LOG_LEVEL: 'warn',
        AUTH_DEV_LOGIN: 'true',
        BOOTSTRAP_ADMIN_EMAILS: 'admin@soredi.example',
      },
    },
    {
      command: 'npx ng serve --port 4200',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
