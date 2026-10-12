import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login } from './support';

// Tests lancés depuis la racine du dépôt (npm run e2e).
const FIXTURE = join(process.cwd(), 'fixtures', 'formations', 'togaf10-m1.formation.json');

/** La formation exemple, sous un identifiant propre au test (les deux formats d'écran partagent la base). */
function formationFile(info: TestInfo): { id: string; titre: string; buffer: Buffer } {
  const formation = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  formation.id = `e2e-${info.project.name}-${Date.now()}`;
  formation.titre = `${formation.titre} (${info.project.name})`;
  return {
    id: formation.id,
    titre: formation.titre,
    buffer: Buffer.from(JSON.stringify(formation, null, 2), 'utf8'),
  };
}

async function openFormations(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Formations' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Formations' })).toBeVisible();
}

test.describe('formations', () => {
  test('rend un rapport lisible pour un fichier invalide', async ({ page }) => {
    await login(page, ADMIN);
    await openFormations(page);
    await page.getByLabel('Fichier .formation.json').setInputFiles({
      name: 'cassee.formation.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ format: '3s-formation', formatVersion: '1.0', id: 'x' }),
      ),
    });
    await page.getByRole('button', { name: 'Vérifier le fichier' }).click();
    const report = page.getByRole('region', { name: 'Rapport de validation' });
    await expect(report).toContainText('Fichier refusé');
    await expect(report.getByRole('listitem').first()).toContainText('racine du fichier');
    await expect(report).toContainText('requiert la propriété modules');
    await expectNoHorizontalOverflow(page);
  });

  test('importe en évaluation, relit, copie en démo, exporte, puis publie', async ({
    page,
  }, info) => {
    test.slow();
    const file = formationFile(info);
    // L'import se fait depuis la production : l'évaluation est une zone de l'administration.
    await login(page, ADMIN);
    await openFormations(page);
    await expect(page.locator('app-space-banner section')).toHaveAttribute(
      'data-space',
      'production',
    );

    await page.getByLabel('Fichier .formation.json').setInputFiles({
      name: `${file.id}.formation.json`,
      mimeType: 'application/json',
      buffer: file.buffer,
    });
    await page.getByRole('button', { name: 'Vérifier le fichier' }).click();
    await expect(
      page.getByText(`Fichier valide : « ${file.titre} », version 0.1.0.`),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Importer en évaluation' }).click();
    await expect(page.getByText('Formation importée en évaluation.')).toBeVisible();
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: file.titre }) });
    await expect(card).toContainText('0.1.0');
    await expect(card).toContainText('courante');
    await expectNoHorizontalOverflow(page);

    // Relecture dans le lecteur : tout est ouvert, rien n'est enregistré.
    await card.getByRole('link', { name: `Relire « ${file.titre} » dans le lecteur` }).click();
    await expect(page.getByRole('heading', { level: 1, name: file.titre })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('rien n’est enregistré');
    await expect(page.getByRole('heading', { name: 'Votre progression' })).toHaveCount(0);
    await page
      .getByRole('link', { name: /^Commencer/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'J’ai terminé' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Activités du module' }).getByRole('link').first(),
    ).toContainText('(À faire)');
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: 'Formations', exact: true }).click();

    // Export : le fichier téléchargé est celui déposé, à l'octet près.
    const download = page.waitForEvent('download');
    await card.getByRole('link', { name: `Exporter « ${file.titre} », version 0.1.0` }).click();
    const exported = await download;
    expect(exported.suggestedFilename()).toBe(`${file.id}-0.1.0.formation.json`);
    const content = readFileSync((await exported.path())!);
    expect(content.equals(file.buffer)).toBe(true);

    // Copie en démonstration, pour la montrer.
    await card
      .getByRole('button', { name: `Copier « ${file.titre} », version 0.1.0, en démonstration` })
      .click();
    await expect(page.getByText(/Version 0\.1\.0 copiée en démonstration/)).toBeVisible();
    await expect(card).toContainText('Copiée en démonstration le');

    // Publication, après confirmation.
    page.once('dialog', (dialog) => dialog.accept());
    await card
      .getByRole('button', { name: `Publier « ${file.titre} », version 0.1.0, en production` })
      .click();
    await expect(page.getByText('Version 0.1.0 publiée en production.')).toBeVisible();
    await expect(card).toContainText('Publiée en production le');

    // Les collaborateurs la trouvent dans les parcours en ligne de la production.
    await page.getByRole('link', { name: 'Parcours en ligne' }).click();
    await expect(page.getByRole('heading', { level: 2, name: file.titre })).toBeVisible();
    // Et la démonstration a sa copie.
    await page.getByRole('button', { name: 'Passer en démonstration' }).click();
    await page.getByRole('link', { name: 'Parcours en ligne' }).click();
    await expect(page.getByRole('heading', { level: 2, name: file.titre })).toBeVisible();
  });
});
