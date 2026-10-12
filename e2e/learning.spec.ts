import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ADMIN, expectNoHorizontalOverflow, login, uniqueEmail } from './support';

// Tests lancés depuis la racine du dépôt (npm run e2e).
const FIXTURE = join(process.cwd(), 'fixtures', 'formations', 'togaf10-m1.formation.json');

interface Question {
  id: string;
  bonnes: string[];
}
interface Activity {
  id: string;
  type: string;
  titre: string;
  obligatoire?: boolean;
  questions?: Question[];
  paires?: { gauche: string; droite: string }[];
}
interface Formation {
  id: string;
  titre: string;
  version: string;
  modules: { id: string; titre: string; activites: Activity[] }[];
}

/**
 * Publie la formation exemple en production, sous un identifiant propre au test, par l'API
 * (le parcours d'import et de publication à l'écran est couvert par formations.spec.ts).
 */
async function publishExample(page: Page, info: TestInfo): Promise<Formation> {
  const formation = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Formation;
  formation.id = `e2e-parcours-${info.project.name}-${Date.now()}`;
  formation.titre = `${formation.titre} (parcours, ${info.project.name})`;

  await login(page, ADMIN);
  const api = page.request;
  const imported = await api.post('/api/formations/import', {
    headers: { 'content-type': 'application/octet-stream' },
    data: Buffer.from(JSON.stringify(formation, null, 2), 'utf8'),
  });
  expect(imported.status()).toBe(201);
  const published = await api.post(
    `/api/formations/${formation.id}/versions/${formation.version}/publication`,
    { data: {} },
  );
  expect(published.ok()).toBe(true);
  await page.context().clearCookies();
  return formation;
}

/** L'activité courante est marquée « Faite » ou « Réussie » dans la navigation du module. */
async function expectStatus(page: Page, titre: string, statut: string): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Activités du module' });
  await expect(nav.getByRole('link', { name: titre })).toContainText(`(${statut})`);
}

async function next(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Activité suivante' }).click();
}

test.describe('parcours en ligne', () => {
  test('un collaborateur suit la formation exemple jusqu’au bout', async ({ page }, info) => {
    test.slow();
    const formation = await publishExample(page, info);
    const module = formation.modules[0]!;

    await login(page, uniqueEmail('apprenant', info));
    await page.getByRole('link', { name: 'Parcours en ligne' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Parcours en ligne' })).toBeVisible();
    await expect(page.getByText('Pas encore de badge')).toBeVisible();
    await page.getByRole('link', { name: `Ouvrir le parcours « ${formation.titre} »` }).click();
    await expect(page.getByRole('heading', { level: 1, name: formation.titre })).toBeVisible();
    await expect(page.getByText('0 module terminé sur 1')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: `Commencer : ${module.titre}` }).click();

    for (const activity of module.activites) {
      await expect(page.getByRole('heading', { level: 1, name: activity.titre })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      switch (activity.type) {
        case 'lecon': {
          // Les blocs « Approfondir » sont repliés par défaut.
          for (const details of await page.locator('article details.approfondir').all()) {
            await expect(details).not.toHaveAttribute('open');
          }
          await page.getByRole('button', { name: 'J’ai terminé' }).click();
          await expectStatus(page, activity.titre, 'Faite');
          break;
        }
        case 'association': {
          for (const paire of activity.paires!) {
            await page
              .getByRole('combobox', { name: `Associer « ${paire.gauche} »` })
              .selectOption(paire.droite);
          }
          await page.getByRole('button', { name: 'Vérifier' }).click();
          await expect(page.getByText('Toutes les associations sont justes !')).toBeVisible();
          await expectStatus(page, activity.titre, 'Faite');
          break;
        }
        case 'scenario': {
          // Entièrement au clavier : le meilleur chemin donne trois étoiles.
          await page.getByRole('button', { name: 'Commencer le cas pratique' }).focus();
          await page.keyboard.press('Enter');
          await page.getByRole('button', { name: /Clarifier avec lui/ }).click();
          await expect(page.getByText('Bon réflexe : partir de la vision métier.')).toBeVisible();
          await page.getByRole('button', { name: /La vente en magasin et en ligne/ }).focus();
          await page.keyboard.press('Enter');
          await expect(page.getByText('3 étoiles sur 3').first()).toBeVisible();
          await expectStatus(page, activity.titre, 'Faite');
          break;
        }
        case 'fiches':
          // Facultative : on passe.
          expect(activity.obligatoire).toBe(false);
          break;
        case 'quiz': {
          await page.getByRole('button', { name: 'Commencer le quiz' }).click();
          const asked = page.locator('fieldset.question');
          await expect(asked).toHaveCount(5);
          for (const fieldset of await asked.all()) {
            const id = (await fieldset.getAttribute('data-question'))!;
            const question = activity.questions!.find((q) => q.id === id)!;
            for (const bonne of question.bonnes) {
              await fieldset.locator(`input[value="${bonne}"]`).check();
            }
          }
          await page.getByRole('button', { name: 'Valider mes réponses' }).click();
          await expect(page.getByText('Quiz réussi.')).toBeVisible();
          await expect(page.getByText('5 bonnes réponses sur 5.')).toBeVisible();
          await expect(page.getByText('Bravo, module terminé !')).toBeVisible();
          await expectStatus(page, activity.titre, 'Réussie');
          break;
        }
        default:
          throw new Error(`Type d'activité non prévu par le test : ${activity.type}`);
      }
      await expectNoHorizontalOverflow(page);
      if (activity !== module.activites.at(-1)) await next(page);
    }

    // Retour au parcours : module terminé, points, niveau et badges.
    await page.getByRole('link', { name: /Retour au parcours/ }).click();
    await expect(page.getByText('1 module terminé sur 1')).toBeVisible();
    await expect(page.getByRole('link', { name: `Revoir : ${module.titre}` })).toBeVisible();
    const profile = page.getByRole('region', { name: 'Votre progression' });
    await expect(profile).toContainText('Niveau 2 — Initié');
    await expect(profile).toContainText('240 points');
    for (const badge of ['Premier pas', 'Module accompli', 'Sans faute', 'Stratège']) {
      await expect(profile.getByText(badge, { exact: true })).toBeVisible();
    }
    await expect(profile.getByText('Parcours terminé', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
