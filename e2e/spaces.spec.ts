import { expect, test } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, uniqueEmail } from './support';

test.describe('espaces production et démonstration', () => {
  test('l’administrateur bascule en démo, joue un rôle, puis revient', async ({ page }) => {
    await login(page, ADMIN);
    const banner = page.locator('app-space-banner section');
    await expect(banner).toHaveAttribute('data-space', 'production');
    await expect(banner).toContainText('Espace production — données réelles');
    await expectNoHorizontalOverflow(page);

    // Bascule au clavier.
    await page.getByRole('button', { name: 'Passer en démonstration' }).focus();
    await page.keyboard.press('Enter');
    await expect(banner).toHaveAttribute('data-space', 'demo');
    await expect(banner).toContainText('Espace démonstration — données fictives');
    const persona = page.getByLabel('Compte joué');
    await expect(persona.locator('option:checked')).toHaveText('Alice Martin — Administrateur');
    await expectNoHorizontalOverflow(page);

    // Les comptes affichés sont ceux de la démonstration.
    await page.getByRole('link', { name: 'Comptes et rôles' }).click();
    await expect(page.getByText('Vous modifiez les comptes fictifs')).toBeVisible();
    await expect(page.getByRole('rowheader', { name: /Emma Petit/ })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: new RegExp(ADMIN) })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // Jouer un collaborateur retire l'administration…
    await persona.selectOption({ label: 'David Moreau — Collaborateur' });
    await expect(page.locator('.account-name')).toContainText('David Moreau');
    await expect(page.getByRole('link', { name: 'Comptes et rôles' })).toHaveCount(0);
    await page.goto('/administration/comptes');
    await expect(page.getByRole('heading', { level: 1, name: 'Accès non autorisé' })).toBeVisible();

    // … mais pas le droit de revenir en production.
    await page.getByRole('button', { name: 'Revenir en production' }).click();
    await expect(banner).toHaveAttribute('data-space', 'production');
    await page.getByRole('link', { name: 'Comptes et rôles' }).click();
    await expect(page.getByRole('rowheader', { name: new RegExp(ADMIN) })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: /Emma Petit/ })).toHaveCount(0);
  });

  test('l’administrateur nomme un manager et lui rattache un collaborateur', async ({
    page,
    browser,
  }, info) => {
    const managerEmail = uniqueEmail('chef', info);
    const employeeEmail = uniqueEmail('collab', info);
    // Les deux comptes existent dès leur première connexion.
    for (const email of [managerEmail, employeeEmail]) {
      const context = await browser.newContext();
      await login(await context.newPage(), email);
      await context.close();
    }

    await login(page, ADMIN);
    await page.getByRole('link', { name: 'Comptes et rôles' }).click();
    const managerName = managerEmail.split('@')[0]!;
    const employeeName = employeeEmail.split('@')[0]!;

    await page.getByLabel(`Rôle de ${managerName}`).selectOption({ label: 'Manager' });
    await expect(page.getByText(`Modification enregistrée pour ${managerName}.`)).toBeVisible();

    await page.getByLabel(`Manager de ${employeeName}`).selectOption({ label: managerName });
    await expect(page.getByText(`Modification enregistrée pour ${employeeName}.`)).toBeVisible();

    await page.reload();
    await expect(
      page.getByLabel(`Manager de ${employeeName}`).locator('option:checked'),
    ).toHaveText(managerName);
  });
});
