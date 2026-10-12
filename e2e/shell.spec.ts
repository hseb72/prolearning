import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, login, uniqueEmail } from './support';

test.describe('cadre du portail', () => {
  test('ouvre le portail en français sur le catalogue, avec onglets et bandeau', async ({
    page,
  }, info) => {
    await login(page, uniqueEmail('accueil', info));
    await expect(page).toHaveTitle('Catalogue — 3S - Pro Learning');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await expect(nav.getByRole('link', { name: 'Catalogue' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'Administration' })).toHaveCount(0);
    await expect(page.locator('.demo[data-space="production"]')).toContainText(
      'Espace production · données réelles.',
    );
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
