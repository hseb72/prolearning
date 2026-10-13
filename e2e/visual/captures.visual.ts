import { expect, request, test, type Page } from '@playwright/test';
import { ADMIN } from '../support';
import { SCENARIOS, type Scenario } from './scenarios';

// Captures des écrans pour la comparaison avec docs/ui/captures/ (npm run visual).

const BASE_URL = 'http://localhost:4200';

/** Démonstration remise à zéro au début de chaque variante : les états restent comparables. */
test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: BASE_URL });
  await devLogin(api);
  expect((await api.post('/api/space', { data: { space: 'demo' } })).ok()).toBe(true);
  expect((await api.post('/api/demo/reinitialisation', { data: {} })).ok()).toBe(true);
  await api.dispose();
});

for (const scenario of SCENARIOS) {
  test(`${scenario.id} ${scenario.titre}`, async ({ page }, info) => {
    await enter(page, scenario);
    await scenario.run(page);
    await settle(page);
    const fullPage = scenario.fullPage ?? true;
    await page.screenshot({
      path: `visual-report/${info.project.name}/${scenario.id}.png`,
      animations: 'disabled',
      caret: 'hide',
      fullPage: fullPage === true,
      ...(typeof fullPage === 'number'
        ? { clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: fullPage } }
        : {}),
    });
  });
}

async function devLogin(api: { post: Page['request']['post'] }): Promise<void> {
  const res = await api.post('/api/auth/dev-login', { data: { email: ADMIN } });
  expect(res.ok()).toBe(true);
}

/** Connexion de l'administrateur, puis bascule dans l'espace et le compte joué du scénario. */
async function enter(page: Page, scenario: Scenario): Promise<void> {
  await devLogin(page.request);
  if (scenario.space === 'production') {
    await page.request.post('/api/space', { data: { space: 'production' } });
    return;
  }
  const personas = (await (await page.request.get('/api/space/personas')).json()) as {
    id: number;
    displayName: string;
  }[];
  const persona = personas.find((p) => p.displayName === scenario.persona);
  expect(persona, `compte joué ${scenario.persona}`).toBeTruthy();
  const res = await page.request.post('/api/space', {
    data: { space: 'demo', personaId: persona!.id },
  });
  expect(res.ok()).toBe(true);
}

/** Polices chargées, requêtes terminées, plus de focus clignotant ni de survol. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.mouse.move(0, 0);
}
