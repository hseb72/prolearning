import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, login, uniqueEmail } from './support';

test.describe('accueil', () => {
  test('affiche le portail en français et l’état du service', async ({ page }, info) => {
    await login(page, uniqueEmail('accueil', info));
    await expect(page).toHaveTitle('3S - Pro Learning');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    // Le front interroge l'API à travers le relais /api, qui joint les deux bases.
    await expect(page.getByRole('status')).toHaveText('Le service est disponible.');
    await expectNoHorizontalOverflow(page);
  });

  test('propose au clavier un lien d’évitement vers le contenu', async ({ page }) => {
    await page.goto('/connexion');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Aller au contenu' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#contenu')).toBeFocused();
  });

  test('signale une page introuvable', async ({ page }) => {
    await page.goto('/page-qui-n-existe-pas');
    await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
  });
});
