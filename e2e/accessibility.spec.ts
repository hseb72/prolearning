import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, login } from './support';

// Audit automatique RGAA / WCAG 2.1 AA (axe) des écrans clés, en clair et en sombre.
// Il ne remplace pas la vérification manuelle (clavier, lecteur d'écran), il l'outille.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function demoAs(page: Page, persona: string): Promise<void> {
  await login(page, ADMIN);
  const personas = (await (await page.request.get('/api/space/personas')).json()) as {
    id: number;
    displayName: string;
  }[];
  const id = personas.find((p) => p.displayName === persona)?.id;
  expect(id, persona).toBeTruthy();
  expect(
    (await page.request.post('/api/space', { data: { space: 'demo', personaId: id } })).ok(),
  ).toBe(true);
}

async function audit(page: Page, url: string, ready: (page: Page) => Promise<void>): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto(url);
    await ready(page);
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = violations.map(
      (v) =>
        `${v.id} (${colorScheme}) : ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    );
    expect(summary, `${url} en ${colorScheme}`).toEqual([]);
  }
}

const h1 = (page: Page) => expect(page.locator('main h1').first()).toBeVisible();

test.describe('accessibilité (axe, WCAG 2.1 AA)', () => {
  test('connexion', async ({ page }) => {
    await audit(page, '/connexion', (p) => expect(p.getByLabel('Adresse e-mail')).toBeVisible());
  });

  test('catalogue, fiche, sessions et demandes d’un collaborateur', async ({ page }) => {
    await demoAs(page, 'David Moreau');
    await audit(page, '/catalogue', (p) =>
      expect(p.locator('app-course-card').first()).toBeVisible(),
    );
    await audit(page, '/catalogue/togaf-fondamentaux', (p) =>
      expect(p.getByRole('dialog')).toBeVisible(),
    );
    await audit(page, '/sessions', (p) =>
      expect(p.locator('app-session-row').first()).toBeVisible(),
    );
    await audit(page, '/demandes', (p) =>
      expect(p.locator('app-request-card').first()).toBeVisible(),
    );
  });

  test('session sur mesure et équipe d’un manager', async ({ page }) => {
    await demoAs(page, 'Chloé Bernard');
    await audit(page, '/demandes/sur-mesure', h1);
    await audit(page, '/demandes/equipe', h1);
  });

  test('parcours en ligne et lecteur', async ({ page }) => {
    await demoAs(page, 'Emma Petit');
    await audit(page, '/parcours', h1);
    await audit(page, '/parcours/togaf10', h1);
    for (const activity of [
      'probleme',
      'domaines-exercice',
      'premier-reflexe',
      'fiches-m1',
      'quiz-m1',
    ]) {
      await audit(page, `/parcours/togaf10/m1-pourquoi-ae/${activity}`, (p) =>
        expect(p.locator('article.act h1')).toBeVisible(),
      );
    }
    await audit(page, '/parcours/kubernetes-fondamentaux/k1-conteneurs/tp-premier-conteneur', (p) =>
      expect(p.locator('article.act h1')).toBeVisible(),
    );
  });

  test('administration', async ({ page }) => {
    await demoAs(page, 'Alice Martin');
    for (const section of ['demandes', 'formations', 'comptes', 'journal']) {
      await audit(page, `/administration/${section}`, h1);
    }
  });
});
