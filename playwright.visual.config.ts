import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// Comparaison visuelle avec les captures du prototype (docs/ui/captures/) : chaque écran,
// dans l'état des captures, à 1280×900 et 390×844, en clair et en sombre. Ce n'est pas un
// test : le script produit visual-report/index.html, à relire côte à côte.
//   npm run visual
// Mêmes bases et mêmes serveurs que les tests de bout en bout (E2E_DATABASE_URL_*).
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] || undefined;
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } };
const mobile = {
  ...devices['Desktop Chrome'],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: 'e2e/visual',
  testMatch: /\.visual\.ts$/,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/visual/report.ts',
  // Un seul navigateur à la fois : les variantes partagent l'espace démonstration.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'bureau-clair', use: { ...desktop, colorScheme: 'light' } },
    { name: 'bureau-sombre', use: { ...desktop, colorScheme: 'dark' } },
    { name: 'mobile-clair', use: { ...mobile, colorScheme: 'light' } },
    { name: 'mobile-sombre', use: { ...mobile, colorScheme: 'dark' } },
  ],
  webServer: base.webServer,
});
