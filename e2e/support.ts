import { expect, type Page, type TestInfo } from '@playwright/test';

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
  await expect(
    page.getByRole('heading', { level: 1, name: 'Bienvenue sur le portail de formation' }),
  ).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
