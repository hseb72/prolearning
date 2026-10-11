import { expect, test } from '@playwright/test';

test.describe('accueil', () => {
  test('affiche le portail en français et l’état du service', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('3S - Pro Learning');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Bienvenue sur le portail de formation' }),
    ).toBeVisible();
    // Le front interroge l'API à travers le relais /api, qui joint les deux bases.
    await expect(page.getByRole('status')).toHaveText('Le service est disponible.');
  });

  test('propose au clavier un lien d’évitement vers le contenu', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Aller au contenu' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#contenu')).toBeFocused();
  });

  test('ne déborde pas horizontalement', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Le service est disponible.');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('signale une page introuvable', async ({ page }) => {
    await page.goto('/page-qui-n-existe-pas');
    await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
    await page.getByRole('link', { name: 'Revenir à l’accueil' }).click();
    await expect(page).toHaveURL('/');
  });
});
