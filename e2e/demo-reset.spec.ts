import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, tab, openAdmin, confirmDialog } from './support';

async function play(page: Page, persona: string): Promise<void> {
  await page.getByLabel('Compte joué').selectOption({ label: persona });
  await expect(page.locator('.me-name')).toContainText(persona.split(' — ')[0]!);
}

test('l’administrateur présente la démonstration, puis la réinitialise', async ({ page }) => {
  test.slow();
  await login(page, ADMIN);
  // Une formation en cours de relecture dans l'évaluation : la réinitialisation n'y touche pas.
  const fixture = JSON.parse(
    readFileSync(
      join(process.cwd(), 'fixtures', 'formations', 'togaf10-m1.formation.json'),
      'utf8',
    ),
  );
  fixture.id = `e2e-en-relecture-${Date.now()}`;
  fixture.titre = 'Formation en relecture';
  const imported = await page.request.post('/api/formations/import', {
    headers: { 'content-type': 'application/octet-stream' },
    data: Buffer.from(JSON.stringify(fixture), 'utf8'),
  });
  expect(imported.status()).toBe(201);
  await page.getByRole('button', { name: 'Passer en démonstration' }).click();
  const banner = page.locator('.demo[data-space]');
  await expect(banner).toHaveAttribute('data-space', 'demo');

  // Le jeu de départ : catalogue fictif, parcours en ligne, demandes en cours.
  await tab(page, 'Catalogue').click();
  await expect(
    page.getByRole('heading', { level: 3, name: 'TOGAF 10 : les fondamentaux' }),
  ).toBeVisible();
  await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();

  await play(page, 'David Moreau — Collaborateur');
  await tab(page, 'Mes demandes').click();
  await expect(
    page.locator('li.request').filter({ hasText: 'TOGAF 10 : les fondamentaux' }),
  ).toContainText('Inscription confirmée');

  // Jouer la manager : valider la demande d'Emma modifie la démonstration…
  await play(page, 'Chloé Bernard — Manager');
  await tab(page, 'Mon équipe').click();
  const toValidate = page.getByRole('region', { name: 'À valider' });
  const emma = toValidate.locator('li.request').filter({ hasText: 'Emma Petit' });
  await expect(emma).toHaveCount(1);
  await emma
    .getByRole('button', {
      name: /^Valider la demande d’Emma Petit|^Valider la demande de Emma Petit/,
    })
    .click();
  await expect(page.getByText(/validée : elle part à l’équipe formation/)).toBeVisible();
  await expect(page.getByText('Aucune demande en attente de votre validation.')).toBeVisible();

  // … la réinitialisation rend le jeu de départ, et rejoue l'administratrice fictive.
  await page.getByRole('button', { name: 'Réinitialiser la démonstration' }).click();
  await confirmDialog(page, 'Réinitialiser la démonstration');
  await expect(
    page.getByText('Démonstration réinitialisée : jeu de départ rechargé.'),
  ).toBeVisible();
  await expect(page.locator('.me-name')).toContainText('Alice Martin');
  await play(page, 'Chloé Bernard — Manager');
  await tab(page, 'Mon équipe').click();
  await expect(toValidate.locator('li.request').filter({ hasText: 'Emma Petit' })).toHaveCount(1);

  // Le bandeau et sa bascule restent utilisables sur un écran de 375 px.
  await page.setViewportSize({ width: 375, height: 740 });
  await expect(page.getByRole('button', { name: 'Réinitialiser la démonstration' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // L'évaluation n'a pas été touchée.
  await play(page, 'Alice Martin — Administrateur');
  await openAdmin(page, 'Formations');
  await expect(page.getByRole('heading', { name: 'Formation en relecture' })).toBeVisible();

  // La production non plus.
  await page.getByRole('button', { name: 'Revenir en production' }).click();
  await expect(banner).toHaveAttribute('data-space', 'production');
  await tab(page, 'Catalogue').click();
  await expect(
    page.getByRole('heading', { level: 3, name: 'TOGAF 10 : les fondamentaux' }),
  ).toHaveCount(0);
});
