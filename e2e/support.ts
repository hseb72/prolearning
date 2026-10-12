import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

export const ADMIN = 'admin@soredi.example';

/** Adresse propre à un test et à un format d'écran : les tests ne se gênent pas. */
export function uniqueEmail(name: string, info: TestInfo): string {
  return `${name}.${info.project.name}.${info.workerIndex}.${Date.now()}@soredi.example`;
}

/** Connexion de développement (le SSO Keycloak n'est pas joignable en test). */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await expect(page).toHaveURL(/\/catalogue$/);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Onglet de l'en-tête, avec ou sans compteur (« Mes demandes 2 »). */
export function tab(page: Page, name: string): Locator {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name: new RegExp(`^${escaped}( \\d+)?$`) });
}

/** Répond « oui » au dialogue de confirmation du portail. */
export async function confirmDialog(page: Page, button: string): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: button, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Rubrique de l'administration (Demandes, Formations, Comptes et rôles). */
export async function openAdmin(page: Page, section: string): Promise<void> {
  await tab(page, 'Administration').click();
  await page
    .getByRole('navigation', { name: 'Rubriques de l’administration' })
    .getByRole('link', { name: section, exact: true })
    .click();
}
