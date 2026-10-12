import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, uniqueEmail } from './support';

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
    await expect(page.getByRole('heading', { level: 1, name: course.titre })).toBeVisible();
    await page.getByRole('button', { name: /Demander mon inscription à la session du/ }).click();
    await page.getByLabel('Message pour votre manager (facultatif)').fill('Pour le projet Atelia.');
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(page.getByText('Demande envoyée à votre manager.')).toBeVisible();
    await expect(
      page.getByText('Votre demande : En attente de validation du manager'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Mes demandes', exact: true }).first().click();
    const mine = page.locator('li.request').filter({ hasText: course.titre });
    await expect(mine).toContainText('En attente de validation du manager');
    await expectNoHorizontalOverflow(page);

    // Le manager valide, au clavier.
    await switchTo(page, manager);
    await page.getByRole('link', { name: 'Mon équipe' }).click();
    const toValidate = page.locator('li.request').filter({ hasText: course.titre });
    await expect(toValidate).toContainText('Pour le projet Atelia.');
    await toValidate.getByLabel('Commentaire (facultatif)').fill('Accord, bonne formation.');
    await toValidate.getByRole('button', { name: /^Valider la demande de/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/validée : elle part à l’équipe formation/)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // L'équipe formation confirme : une place est prise.
    await switchTo(page, ADMIN);
    await page.getByRole('link', { name: 'Demandes à traiter' }).click();
    const toConfirm = page.locator('li.request').filter({ hasText: course.titre });
    await expect(toConfirm).toContainText('2 places restantes sur 2');
    await toConfirm.getByRole('button', { name: /^Confirmer l’inscription de/ }).click();
    await expect(page.getByText(/Inscription de .* confirmée\./)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // La collaboratrice voit sa place confirmée et l'historique.
    await switchTo(page, collab);
    await page.getByRole('link', { name: 'Mes demandes', exact: true }).click();
    await expect(mine).toContainText('Inscription confirmée');
    await mine.getByText('Historique').click();
    await expect(mine).toContainText('Accord, bonne formation.');
    await page.goto(`/catalogue/${course.id}`);
    await expect(page.getByText('1 place restante sur 2')).toBeVisible();
    await expect(page.getByText('Votre demande : Inscription confirmée')).toBeVisible();
  });

  test('session sur mesure : demandée par un manager, acceptée par l’équipe formation', async ({
    page,
  }, info) => {
    const { manager } = await setup(page, info);
    const sujet = `Atelier ArchiMate ${info.project.name} ${Date.now()}`;

    await switchTo(page, manager);
    await page.getByRole('link', { name: 'Mes demandes', exact: true }).click();
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
    await page.getByRole('link', { name: 'Demandes à traiter' }).click();
    const item = page.locator('li.request').filter({ hasText: sujet });
    await item.getByLabel('Réponse au demandeur (facultatif)').fill('Session le 20 novembre.');
    await item.getByRole('button', { name: `Accepter la demande « ${sujet} »` }).click();
    await expect(page.getByText('Demande mise à jour.')).toBeVisible();
    await expect(item).toContainText('Acceptée');

    await switchTo(page, manager);
    await page.getByRole('link', { name: 'Mes demandes', exact: true }).click();
    await expect(mine).toContainText('Acceptée');
    await mine.getByText('Historique').click();
    await expect(mine).toContainText('Session le 20 novembre.');
    await expectNoHorizontalOverflow(page);
  });

  test('les pages de validation sont réservées', async ({ page }, info) => {
    await login(page, uniqueEmail('simple', info));
    await expect(page.getByRole('link', { name: 'Mon équipe' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Demandes à traiter' })).toHaveCount(0);
    await page.goto('/demandes/a-traiter');
    await expect(page.getByRole('heading', { level: 1, name: 'Accès non autorisé' })).toBeVisible();
  });
});
