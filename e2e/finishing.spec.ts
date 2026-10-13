import { expect, test } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, openAdmin } from './support';

test.describe('finitions', () => {
  test('l’administrateur consulte le journal et le filtre', async ({ page }) => {
    await login(page, ADMIN);
    await openAdmin(page, 'Journal');
    await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible();
    const rows = page.locator('table.journal tbody tr');
    await expect(rows.first()).toBeVisible();
    await page
      .getByRole('group', { name: 'Type d’action' })
      .getByRole('button', { name: 'Connexions', exact: true })
      .click();
    await expect(rows.first().getByRole('rowheader')).toHaveText('Connexion');
    for (const header of await rows.getByRole('rowheader').allTextContents()) {
      expect(header).toBe('Connexion');
    }
    await expectNoHorizontalOverflow(page);
  });

  test('le thème choisi s’applique et reste mémorisé', async ({ page }) => {
    await login(page, ADMIN);
    const root = page.locator('html');
    await expect(root).not.toHaveAttribute('data-theme');
    await page.getByLabel('Apparence').selectOption({ label: 'Sombre' });
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByLabel('Apparence')).toHaveValue('dark');
    await page.getByLabel('Apparence').selectOption({ label: 'Celui du système' });
    await expect(root).not.toHaveAttribute('data-theme');
  });
});
