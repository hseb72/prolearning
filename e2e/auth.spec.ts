import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, login, uniqueEmail, tab } from './support';

test.describe('connexion', () => {
  test('renvoie vers la connexion, puis vers la page demandée', async ({ page }, info) => {
    await page.goto('/administration/comptes');
    await expect(page).toHaveURL(/\/connexion\?retour=%2Fadministration%2Fcomptes$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Un collaborateur n'a pas accès à l'administration.
    await page.getByLabel('Adresse e-mail').fill(uniqueEmail('lea', info));
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Accès non autorisé' })).toBeVisible();
  });

  test('refuse une adresse invalide, avec un message lié au champ', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Adresse e-mail').fill('pas-une-adresse');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    const field = page.getByLabel('Adresse e-mail');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#dev-error')).toHaveText('Saisissez une adresse e-mail valide.');
  });

  test('montre au collaborateur son nom et son rôle, sans bandeau d’espace', async ({
    page,
  }, info) => {
    await login(page, uniqueEmail('marc', info));
    await expect(page.locator('.me-name')).toContainText('· collaborateur');
    await expect(page.getByRole('button', { name: 'Passer en démonstration' })).toHaveCount(0);
    await expect(tab(page, 'Administration')).toHaveCount(0);

    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/connexion/);
  });

  test('explique une connexion SSO refusée', async ({ page }) => {
    await page.goto('/connexion?erreur=sso-refuse');
    await expect(page.getByRole('alert')).toHaveText(
      'La connexion a expiré ou a été refusée. Recommencez.',
    );
  });
});
