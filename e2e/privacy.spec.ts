import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  ADMIN,
  confirmDialog,
  expectNoHorizontalOverflow,
  login,
  openAdmin,
  uniqueEmail,
} from './support';

test.describe('données personnelles', () => {
  test('un collaborateur consulte ce qui est gardé et télécharge ses données', async ({
    page,
  }, info) => {
    const email = uniqueEmail('donnees', info);
    await login(page, email);
    await page.getByRole('link', { name: 'Mes données personnelles' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mes données personnelles' }),
    ).toBeVisible();
    await expect(page.getByText(/Demandes clôturées .* : 36 mois \(3 ans\)/)).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Télécharger mes données' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^mes-donnees-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(readFileSync((await file.path())!, 'utf8'));
    expect(data.compte.email).toBe(email);
    await expectNoHorizontalOverflow(page);
  });

  test('l’administrateur règle les durées, exporte puis supprime un compte', async ({
    page,
  }, info) => {
    const email = uniqueEmail('a-supprimer', info);
    await login(page, email);
    await page.context().clearCookies();
    await login(page, ADMIN);

    await openAdmin(page, 'Données personnelles');
    const journal = page.getByLabel('Journal (mois)');
    await expect(journal).toHaveValue('12');
    await journal.fill('18');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.toast')).toContainText('Durées de conservation enregistrées.');
    await journal.fill('12');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('.toast')).toContainText('Durées de conservation enregistrées.');

    await openAdmin(page, 'Comptes et rôles');
    const row = page.getByRole('row').filter({ hasText: email });
    const name = (await row.locator('.name').textContent())!.trim();
    const download = page.waitForEvent('download');
    await row.getByRole('link', { name: `Exporter les données de ${name}` }).click();
    const data = JSON.parse(readFileSync((await (await download).path())!, 'utf8'));
    expect(data.compte.email).toBe(email);

    await row
      .getByRole('button', { name: `Supprimer le compte de ${name} et ses données` })
      .click();
    await confirmDialog(page, 'Supprimer définitivement');
    await expect(page.locator('.toast')).toContainText(`Compte de ${name} supprimé`);
    await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
    // On ne peut pas supprimer son propre compte : pas de bouton sur sa ligne.
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: ADMIN })
        .getByRole('button', { name: /^Supprimer le compte/ }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
