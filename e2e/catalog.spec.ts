import { expect, test } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, uniqueEmail } from './support';

/** Date de saisie (heure de Paris) dans `days` jours, au format d'un champ datetime-local. */
function localDate(days: number, time: string): string {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return `${d.toISOString().slice(0, 10)}T${time}`;
}

test.describe('catalogue et sessions', () => {
  test('l’équipe formation publie une fiche et ses sessions, un collaborateur les trouve', async ({
    page,
  }, info) => {
    const id = `e2e-${info.project.name}-${Date.now()}`;
    const titre = `Modélisation ArchiMate (${info.project.name} ${Date.now()})`;

    // L'administrateur a les droits de l'équipe formation.
    await login(page, ADMIN);
    await page.getByRole('link', { name: 'Catalogue' }).click();
    await page.getByRole('link', { name: 'Nouvelle fiche' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nouvelle fiche formation' }),
    ).toBeVisible();
    await page.getByLabel('Identifiant').fill(id);
    await page.getByLabel('Titre').fill(titre);
    await page.getByLabel('Thème').fill('Architecture e2e');
    await page.getByLabel('Résumé').fill('Décrire une architecture avec **ArchiMate**.');
    await page.getByLabel('Objectifs').fill('Lire une vue ArchiMate\nModéliser un processus');
    await page.getByLabel('Durée d’une session (heures)').fill('14');
    await page.getByLabel('Publier la fiche').check();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible();
    await expect(page.getByText('2 jours (14 h)')).toBeVisible();
    await expect(page.getByText('Aucune session à venir.')).toBeVisible();

    // Deux sessions : une sur site, une à distance qu'on annule ensuite.
    for (const [modalite, days, lieu] of [
      ['Sur site', 30, 'Lyon, salle Confluence'],
      ['À distance', 40, 'Teams'],
    ] as const) {
      await page.getByRole('button', { name: 'Programmer une session' }).click();
      const form = page.getByRole('form', { name: 'Programmer une session' });
      await form.getByLabel('Modalité').selectOption({ label: modalite });
      await form.getByLabel('Places').fill('6');
      await form.getByLabel('Début (heure de Paris)').fill(localDate(days, '09:00'));
      await form.getByLabel('Fin (heure de Paris)').fill(localDate(days + 1, '17:00'));
      await form.getByLabel('Lieu ou outil').fill(lieu);
      await form.getByLabel('Formateur').fill('Claire Dubois');
      await expectNoHorizontalOverflow(page);
      await form.getByRole('button', { name: 'Enregistrer la session' }).click();
      await expect(page.getByText('Session enregistrée.')).toBeVisible();
    }
    const sessions = page.locator('li.session');
    await expect(sessions).toHaveCount(2);
    await expect(sessions.first()).toContainText('Lieu : Lyon, salle Confluence');
    await expect(sessions.first()).toContainText('6 places restantes sur 6');

    page.once('dialog', (dialog) => dialog.accept());
    await sessions
      .nth(1)
      .getByRole('button', { name: /Annuler la session/ })
      .click();
    await expect(page.getByText('Session annulée.')).toBeVisible();
    await expect(sessions.nth(1)).toContainText('Annulée');
    await expectNoHorizontalOverflow(page);
    await page.context().clearCookies();

    // Un collaborateur trouve la fiche par le filtre de format, puis dans l'agenda.
    await login(page, uniqueEmail('catalogue', info));
    await page.getByRole('link', { name: 'Catalogue' }).click();
    await page.getByLabel('Rechercher').fill('archimate');
    await page.getByLabel('Format', { exact: true }).selectOption({ label: 'À distance' });
    await expect(page.getByRole('heading', { level: 2, name: titre })).toHaveCount(0);
    await page.getByLabel('Format', { exact: true }).selectOption({ label: 'Sur site' });
    await expect(page.getByRole('heading', { level: 2, name: titre })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: `Voir la fiche « ${titre} »` }).click();

    await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Modifier la fiche' })).toHaveCount(0);
    await expect(page.locator('li.session')).toHaveCount(1);
    await expect(page.locator('li.session')).toContainText('Sur site');
    await expect(page.getByRole('button', { name: 'Programmer une session' })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    const entry = page.locator('li.session').filter({ hasText: titre });
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('6 places restantes sur 6');
    await expectNoHorizontalOverflow(page);
  });

  test('la création de fiche est réservée à l’équipe formation', async ({ page }, info) => {
    await login(page, uniqueEmail('curieux', info));
    await page.getByRole('link', { name: 'Catalogue' }).click();
    await expect(page.getByRole('link', { name: 'Nouvelle fiche' })).toHaveCount(0);
    await page.goto('/catalogue/nouvelle');
    await expect(page.getByRole('heading', { level: 1, name: 'Accès non autorisé' })).toBeVisible();
  });
});
