import { expect, test } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, uniqueEmail } from './support';

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

test.describe('bibliothèque de composants', () => {
  test('réservée aux administrateurs, dans les deux thèmes', async ({ page }, info) => {
    await login(page, uniqueEmail('composants', info));
    await page.goto('/administration/composants');
    await expect(page.getByRole('heading', { level: 1, name: 'Accès non autorisé' })).toBeVisible();
    await page.context().clearCookies();

    await login(page, ADMIN);
    await page.goto('/administration/composants');
    await expect(page.getByRole('heading', { level: 1, name: 'Composants' })).toBeVisible();
    await expect(page.locator('.theme-scope[data-theme="light"]')).toBeVisible();
    await expect(page.locator('.theme-scope[data-theme="dark"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Dialogue natif : ouvert, puis fermé par Échap.
    const light = page.locator('.theme-scope[data-theme="light"]');
    await light.getByRole('button', { name: 'Ouvrir un dialogue' }).click();
    const dialog = page.getByRole('dialog', { name: 'Kubernetes : les fondamentaux' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Filtres : un seul actif.
    const chips = light.getByRole('group', { name: 'Modalité' });
    await chips.getByRole('button', { name: 'Sur site' }).click();
    await expect(chips.getByRole('button', { name: 'Sur site' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(chips.getByRole('button', { name: 'Toutes' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // Toast.
    await light.getByRole('button', { name: 'Afficher un toast' }).click();
    await expect(page.locator('.toast')).toContainText('Kubernetes : les fondamentaux');
  });
});
