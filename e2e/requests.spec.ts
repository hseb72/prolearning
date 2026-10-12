import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, uniqueEmail, tab, openAdmin } from './support';

const inDays = (days: number, hours: number) => {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  d.setUTCHours(hours, 0, 0, 0);
  return d.toISOString();
};

async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await login(page, email);
}

/**
 * Prépare par l'API (en administrateur) une fiche publiée avec une session de deux places,
 * un manager et une collaboratrice rattachée. Les écrans de gestion sont couverts ailleurs.
 */
async function setup(page: Page, info: TestInfo) {
  const stamp = `${info.project.name}-${Date.now()}`;
  const course = { id: `e2e-demandes-${stamp}`, titre: `Conduite du changement (${stamp})` };
  const manager = uniqueEmail('manager', info);
  const collab = uniqueEmail('collab', info);
  for (const email of [manager, collab]) await switchTo(page, email);

  await switchTo(page, ADMIN);
  const api = page.request;
  expect(
    (
      await api.post('/api/catalogue', {
        data: { ...course, theme: 'Management', resume: 'Accompagner.', publiee: true },
      })
    ).status(),
  ).toBe(201);
  const session = await api.post(`/api/catalogue/${course.id}/sessions`, {
    data: { modalite: 'site', debut: inDays(20, 7), fin: inDays(20, 15), places: 2, lieu: 'Paris' },
  });
  expect(session.status()).toBe(201);
  const users = (await (await api.get('/api/users')).json()) as { id: number; email: string }[];
  const id = (email: string) => users.find((u) => u.email === email)!.id;
  expect((await api.patch(`/api/users/${id(manager)}`, { data: { role: 'manager' } })).ok()).toBe(
    true,
  );
  expect(
    (await api.patch(`/api/users/${id(collab)}`, { data: { managerId: id(manager) } })).ok(),
  ).toBe(true);
  return { course, manager, collab };
}

test.describe('demandes', () => {
  test('inscription : demande, validation du manager, confirmation par l’équipe formation', async ({
    page,
  }, info) => {
    test.slow();
    const { course, manager, collab } = await setup(page, info);

    // La collaboratrice demande son inscription depuis la fiche.
    await switchTo(page, collab);
    await page.goto(`/catalogue/${course.id}`);
    const sheet = page.getByRole('dialog', { name: course.titre }).first();
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: /S’inscrire à la session du/ }).click();
    const ask = page.getByRole('dialog').filter({ hasText: 'Demande d’inscription' });
    await ask.getByLabel('Ce que vous attendez de la formation').fill('Pour le projet Atelia.');
    await expectNoHorizontalOverflow(page);
    await ask.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(page.locator('.toast')).toContainText('Demande d’inscription envoyée');
    await expect(sheet.locator('app-status')).toHaveText('Envoyée');
    await sheet.getByRole('button', { name: 'Fermer' }).click();
    await tab(page, 'Mes demandes').click();
    const mine = page.locator('li.request').filter({ hasText: course.titre });
    await expect(mine).toContainText('En attente de validation du manager');
    await expectNoHorizontalOverflow(page);

    // Le manager valide, au clavier.
    await switchTo(page, manager);
    await tab(page, 'Mon équipe').click();
    const toValidate = page.locator('li.request').filter({ hasText: course.titre });
    await expect(toValidate).toContainText('Pour le projet Atelia.');
    await toValidate.getByLabel('Commentaire (facultatif)').fill('Accord, bonne formation.');
    await toValidate.getByRole('button', { name: /^Valider la demande de/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/validée : elle part à l’équipe formation/)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // L'équipe formation confirme : une place est prise.
    await switchTo(page, ADMIN);
    await openAdmin(page, 'Demandes');
    const toConfirm = page.locator('li.request').filter({ hasText: course.titre });
    await expect(toConfirm).toContainText('2 places restantes sur 2');
    await toConfirm.getByRole('button', { name: /^Confirmer l’inscription de/ }).click();
    await expect(page.getByText(/Inscription de .* confirmée\./)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // La collaboratrice voit sa place confirmée et l'historique.
    await switchTo(page, collab);
    await tab(page, 'Mes demandes').click();
    await expect(mine).toContainText('Inscription confirmée');
    await mine.getByText('Historique').click();
    await expect(mine).toContainText('Accord, bonne formation.');
    await page.goto(`/catalogue/${course.id}`);
    await expect(page.getByRole('dialog').locator('app-status')).toHaveText('Acceptée');
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
    await tab(page, 'Sessions').click();
    const row = page.locator('app-session-row').filter({ hasText: course.titre });
    await expect(row).toContainText('1 place sur 2');
    await expect(row.getByRole('link', { name: 'Demande envoyée' })).toBeVisible();
  });

  test('session sur mesure : demandée par un manager, acceptée par l’équipe formation', async ({
    page,
  }, info) => {
    const { manager } = await setup(page, info);
    const sujet = `Atelier ArchiMate ${info.project.name} ${Date.now()}`;

    await switchTo(page, manager);
    await tab(page, 'Mes demandes').click();
    await page.getByRole('link', { name: 'Demander une session sur mesure' }).click();
    await page.getByLabel('Sujet').fill(sujet);
    await page.getByLabel('Modalité souhaitée').selectOption({ label: 'Sur site' });
    await page.getByLabel('Nombre de participants').fill('8');
    await page.getByLabel('Période souhaitée').fill('Novembre');
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(page.getByText('Demande envoyée à l’équipe formation.')).toBeVisible();
    const mine = page.locator('li.request').filter({ hasText: sujet });
    await expect(mine).toContainText('Transmise à l’équipe formation');

    await switchTo(page, ADMIN);
    await openAdmin(page, 'Demandes');
    const item = page.locator('li.request').filter({ hasText: sujet });
    await item.getByLabel('Réponse au demandeur (facultatif)').fill('Session le 20 novembre.');
    await item.getByRole('button', { name: `Accepter la demande « ${sujet} »` }).click();
    await expect(page.getByText('Demande mise à jour.')).toBeVisible();
    await expect(item).toContainText('Acceptée');

    await switchTo(page, manager);
    await tab(page, 'Mes demandes').click();
    await expect(mine).toContainText('Acceptée');
    await mine.getByText('Historique').click();
    await expect(mine).toContainText('Session le 20 novembre.');
    await expectNoHorizontalOverflow(page);
  });

  test('les pages de validation sont réservées', async ({ page }, info) => {
    await login(page, uniqueEmail('simple', info));
    await expect(tab(page, 'Mon équipe')).toHaveCount(0);
    await expect(tab(page, 'Administration')).toHaveCount(0);
    await page.goto('/demandes/a-traiter');
    await expect(page.getByRole('heading', { level: 1, name: 'Accès non autorisé' })).toBeVisible();
  });
});
