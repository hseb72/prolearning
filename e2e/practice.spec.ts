import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, uniqueEmail } from './support';

// Tests lancés depuis la racine du dépôt (npm run e2e).
const FIXTURE = join(
  process.cwd(),
  'fixtures',
  'formations',
  'kubernetes-fondamentaux.formation.json',
);

test.describe('travaux pratiques (format 1.1)', () => {
  test('copier, télécharger, cocher la vérification, terminer le TP', async ({
    page,
    context,
  }, info) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const formation = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    formation.id = `e2e-tp-${info.project.name}-${Date.now()}`;
    formation.titre = `Kubernetes (${info.project.name} ${Date.now()})`;
    const module = formation.modules[0];
    const tp = module.activites.find((a: { type: string }) => a.type === 'pratique');

    // Import en évaluation, puis publication en production (par l'API).
    await login(page, ADMIN);
    const imported = await page.request.post('/api/formations/import', {
      headers: { 'content-type': 'application/octet-stream' },
      data: Buffer.from(JSON.stringify(formation), 'utf8'),
    });
    expect(imported.status()).toBe(201);
    const published = await page.request.post(
      `/api/formations/${formation.id}/versions/${formation.version}/publication`,
      { data: {} },
    );
    expect(published.ok()).toBe(true);
    await page.context().clearCookies();

    await login(page, uniqueEmail('tp', info));
    await page.goto(`/parcours/${formation.id}/${module.id}/${tp.id}`);
    await expect(page.getByRole('heading', { level: 1, name: tp.titre })).toBeVisible();
    await expect(page.getByText('Travaux pratiques ·').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Les blocs de code des étapes ont un bouton « Copier ».
    const copyCode = page.getByRole('button', { name: 'Copier le code' }).first();
    await copyCode.click();
    await expect(copyCode).toHaveText('Copié');
    expect((await page.evaluate(() => navigator.clipboard.readText())).length).toBeGreaterThan(0);

    // Fichiers fournis : copie et archive qui respecte les noms.
    const first = tp.fichiers[0];
    await page.getByRole('button', { name: `Copier le contenu de ${first.nom}` }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first.contenu);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /en une archive \.zip/ }).click();
    const archive = await download;
    expect(archive.suggestedFilename()).toBe(`${tp.id}.zip`);
    const bytes = readFileSync((await archive.path())!);
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    for (const f of tp.fichiers) expect(bytes.includes(Buffer.from(f.nom))).toBe(true);

    // La solution est repliée par défaut.
    await expect(page.locator('app-deepen.approfondir details').last()).not.toHaveAttribute('open');

    // Vérification : incomplète, puis complète (au clavier).
    await page.getByRole('button', { name: 'J’ai tout vérifié' }).click();
    await expect(page.getByText(/Il reste \d+ points? à vérifier/)).toBeVisible();
    const boxes = page.locator('form.tp-check input[type=checkbox]');
    await expect(boxes).toHaveCount(tp.verification.length);
    for (const box of await boxes.all()) {
      await box.focus();
      await page.keyboard.press('Space');
    }
    await page.getByRole('button', { name: 'J’ai tout vérifié' }).click();
    await expect(page.getByText('Travaux pratiques terminés. +30 points')).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Activités du module' });
    await expect(nav.getByRole('link', { name: tp.titre })).toContainText('(Faite)');
    await expectNoHorizontalOverflow(page);
  });
});
