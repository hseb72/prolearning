import { expect, type Page } from '@playwright/test';

/** Variantes capturées : un projet Playwright chacune (playwright.visual.config.ts). */
export const VARIANTS = ['bureau-clair', 'bureau-sombre', 'mobile-clair', 'mobile-sombre'] as const;
export type Variant = (typeof VARIANTS)[number];

/** Compte joué dans l'espace démonstration (fixtures/demo/comptes.json). */
export type Persona = 'Alice Martin' | 'Bruno Lefèvre' | 'Chloé Bernard' | 'David Moreau';

export interface Scenario {
  /** Nom du fichier produit, dans visual-report/<variante>/. */
  id: string;
  titre: string;
  /** Capture de référence de docs/ui/captures/ (sans .png) pour chaque variante qui en a une. */
  refs: Partial<Record<Variant, string>>;
  /** Espace et compte joué ; production : l'administrateur réel. */
  space: 'production' | 'demo';
  persona?: Persona;
  /** false : la fenêtre seule (dialogues, toast) ; un nombre : la hauteur du haut de page. */
  fullPage?: boolean | number;
  /** Écarts connus et assumés, repris dans le rapport. */
  ecarts?: string[];
  run(page: Page): Promise<void>;
}

const TOGAF = '/parcours/togaf10/m1-pourquoi-ae';
const K8S = '/parcours/kubernetes-fondamentaux/k1-conteneurs';

async function heading(page: Page, name: string | RegExp, level = 1): Promise<void> {
  await expect(page.getByRole('heading', { level, name })).toBeVisible();
}

async function activity(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('article.act h1')).toBeVisible();
}

/** Les écrans, dans l'ordre des captures de référence, puis ceux qui n'en ont pas. */
export const SCENARIOS: Scenario[] = [
  {
    id: '01-catalogue',
    titre: 'Catalogue',
    refs: {
      'bureau-clair': '01-catalogue',
      'bureau-sombre': '01-catalogue-sombre',
      'mobile-clair': '01-catalogue-mobile',
    },
    space: 'demo',
    persona: 'Chloé Bernard',
    async run(page) {
      await page.goto('/catalogue');
      await expect(page.locator('app-course-card')).toHaveCount(7);
    },
  },
  {
    id: '02-catalogue-fiche',
    titre: 'Fiche formation (dialogue)',
    refs: { 'bureau-clair': '02-catalogue-fiche' },
    space: 'demo',
    persona: 'Chloé Bernard',
    fullPage: false,
    ecarts: [
      'Pas de liste d’attente (décision C) : une session complète affiche « Complet ».',
      'Dates des sessions relatives au jour du chargement de la démonstration.',
    ],
    async run(page) {
      await page.goto('/catalogue/togaf-fondamentaux');
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    id: '03-sessions',
    titre: 'Sessions planifiées',
    refs: {
      'bureau-clair': '03-sessions',
      'bureau-sombre': '03-sessions-sombre',
      'mobile-clair': '03-sessions-mobile',
    },
    space: 'demo',
    persona: 'David Moreau',
    ecarts: ['Une session déjà demandée affiche « Demande envoyée » (jeu de démonstration).'],
    async run(page) {
      await page.goto('/sessions');
      await expect(page.locator('app-session-row').first()).toBeVisible();
    },
  },
  {
    id: '04-dialog-inscription',
    titre: 'Demande d’inscription (dialogue)',
    refs: { 'bureau-clair': '04-dialog-inscription' },
    space: 'demo',
    persona: 'David Moreau',
    fullPage: false,
    ecarts: ['Pas de case « J’ai informé mon manager » (décision E) : le manager valide.'],
    async run(page) {
      await page.goto('/sessions');
      await page
        .locator('app-session-row')
        .getByRole('button', { name: /^Demander/ })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    id: '05-session-sur-mesure',
    titre: 'Session sur mesure',
    refs: { 'bureau-clair': '05-session-sur-mesure' },
    space: 'demo',
    persona: 'Chloé Bernard',
    ecarts: ['Champs de la demande conservés (décision D) : sujet, période en texte libre.'],
    async run(page) {
      await page.goto('/demandes/sur-mesure');
      await page.getByLabel('Formation', { exact: true }).selectOption({
        label: 'Kubernetes : les fondamentaux',
      });
      await page.getByLabel('Sujet').fill('Kubernetes : les fondamentaux');
      await page.getByLabel('Nombre de participants').fill('8');
      await page.getByRole('radio', { name: 'Sur site' }).check();
      await page.getByLabel('Période souhaitée').fill('du 1 février 2027 au 15 mars 2027');
    },
  },
  {
    id: '06-mes-demandes',
    titre: 'Mes demandes',
    refs: { 'bureau-clair': '06-mes-demandes' },
    space: 'demo',
    persona: 'Chloé Bernard',
    async run(page) {
      await page.goto('/demandes');
      await expect(page.locator('app-request-card').first()).toBeVisible();
    },
  },
  {
    id: '06-mes-demandes-avec-toast',
    titre: 'Mes demandes, après l’envoi',
    refs: { 'bureau-clair': '06-mes-demandes-avec-toast' },
    space: 'demo',
    persona: 'Chloé Bernard',
    fullPage: false,
    async run(page) {
      await page.goto('/demandes/sur-mesure');
      await page.getByLabel('Formation', { exact: true }).selectOption({
        label: 'Kubernetes : les fondamentaux',
      });
      await page.getByLabel('Sujet').fill('Kubernetes : les fondamentaux');
      await page.getByLabel('Nombre de participants').fill('8');
      await page.getByRole('radio', { name: 'Sur site' }).check();
      await page.getByLabel('Période souhaitée').fill('du 1 février 2027 au 15 mars 2027');
      await page.getByRole('button', { name: 'Envoyer la demande' }).click();
      await expect(page.locator('.toast')).toBeVisible();
      await expect(page.locator('app-request-card').first()).toBeVisible();
    },
  },
  {
    id: '07-admin-demandes',
    titre: 'Administration › Demandes',
    refs: { 'bureau-clair': '07-admin-demandes' },
    space: 'demo',
    persona: 'Alice Martin',
    ecarts: [
      'L’administration est découpée en rubriques (décision F) : demandes et formations sur deux pages.',
      'Validation manager conservée (décision C) : la file montre aussi les demandes en attente du manager.',
    ],
    async run(page) {
      await page.goto('/administration/demandes');
      await heading(page, /demandes/i);
    },
  },
  {
    id: '08-admin-import-erreurs',
    titre: 'Import refusé : rapport de validation',
    refs: { 'bureau-clair': '08-admin-import-erreurs' },
    space: 'demo',
    persona: 'Alice Martin',
    ecarts: ['Messages du validateur de la plateforme (parité avec le validateur de référence).'],
    async run(page) {
      await page.goto('/administration/formations');
      const formation = JSON.parse(await fixture('togaf10-m1.formation.json'));
      formation.formatVersion = '2.0';
      await page.getByLabel('Choisir un fichier').setInputFiles({
        name: 'bad.formation.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(formation)),
      });
      await expect(page.getByRole('region', { name: 'Rapport de validation' })).toBeVisible();
    },
  },
  {
    id: '09a-admin-import-valide',
    titre: 'Import : fichier valide',
    refs: { 'bureau-clair': '09a-admin-import-valide' },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await page.goto('/administration/formations');
      await page.getByLabel('Choisir un fichier').setInputFiles({
        name: 'kubernetes.formation.json',
        mimeType: 'application/json',
        buffer: Buffer.from(await fixture('kubernetes-fondamentaux.formation.json')),
      });
      await expect(page.getByRole('region', { name: 'Rapport de validation' })).toBeVisible();
    },
  },
  {
    id: '09b-admin-formations-evaluation',
    titre: 'Formations : évaluation et démonstration',
    refs: { 'bureau-clair': '09b-admin-formations-evaluation' },
    space: 'demo',
    persona: 'Alice Martin',
    ecarts: [
      'Pas d’action « Retirer » : une formation importée reste en évaluation (règles du § 11).',
      'La démonstration liste aussi les formations du jeu de démonstration.',
    ],
    async run(page) {
      await importFixture(page, 'kubernetes-fondamentaux.formation.json');
      await page.request.post('/api/formations/kubernetes-fondamentaux/versions/1.0.0/copie-demo', {
        data: {},
      });
      await page.goto('/administration/formations');
      await expect(page.locator('article.formation').first()).toBeVisible();
    },
  },
  {
    id: '10-parcours-carte',
    titre: 'Vue d’ensemble d’un parcours (TOGAF 10)',
    refs: { 'bureau-clair': '10-parcours-carte', 'mobile-clair': '10-parcours-carte-mobile' },
    space: 'demo',
    persona: 'Alice Martin',
    ecarts: [
      'Niveaux et badges de la plateforme (décision B), présentés comme dans le prototype.',
      'Ni « Mission Atelia », ni « Tout débloquer », ni remise à zéro (décision H).',
    ],
    async run(page) {
      await page.goto('/parcours/togaf10');
      await expect(page.locator('app-module-tile, [appModuleTile]').first()).toBeVisible();
    },
  },
  {
    id: '11-lecteur-lecon',
    titre: 'Lecteur : leçon, « Approfondir » ouvert',
    refs: {
      'bureau-clair': '11-lecteur-lecon-approfondir',
      'bureau-sombre': '11-lecteur-lecon-sombre',
      'mobile-clair': '11-lecteur-lecon-mobile',
    },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await activity(page, `${TOGAF}/probleme`);
      await page.locator('app-deepen summary').first().click();
    },
  },
  {
    id: '12-lecteur-association-verifiee',
    titre: 'Lecteur : association vérifiée',
    refs: { 'bureau-clair': '12-lecteur-association-verifiee' },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await activity(page, `${TOGAF}/domaines-exercice`);
      for (const select of await page.locator('article.act select').all()) {
        await select.selectOption({ index: 1 });
      }
      await page.getByRole('button', { name: 'Vérifier' }).click();
      await expect(page.locator('article.act .fb')).toBeVisible();
    },
  },
  {
    id: '13-lecteur-scenario-choix',
    titre: 'Lecteur : mise en situation, conséquence d’un choix',
    refs: { 'bureau-clair': '13-lecteur-scenario-choix' },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await activity(page, `${TOGAF}/premier-reflexe`);
      await page.getByRole('button', { name: 'Commencer le cas pratique' }).click();
      await page.getByRole('button', { name: /Lancer tout de suite/ }).click();
      await expect(page.getByRole('button', { name: 'Suite', exact: true })).toBeVisible();
    },
  },
  {
    id: '14-lecteur-scenario-bilan',
    titre: 'Lecteur : mise en situation, bilan',
    refs: { 'bureau-clair': '14-lecteur-scenario-bilan' },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await activity(page, `${TOGAF}/premier-reflexe`);
      await page.getByRole('button', { name: 'Commencer le cas pratique' }).click();
      await page.getByRole('button', { name: /Lancer tout de suite/ }).click();
      await page.getByRole('button', { name: 'Suite', exact: true }).click();
      await page.getByRole('button', { name: /La vente en magasin et en ligne/ }).click();
      await expect(page.getByText(/étoiles? sur 3/).first()).toBeVisible();
    },
  },
  {
    id: '15-lecteur-fiches',
    titre: 'Lecteur : fiches de révision',
    refs: { 'bureau-clair': '15-lecteur-fiches' },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await activity(page, `${TOGAF}/fiches-m1`);
      await page.locator('.cards .flip').nth(1).click();
    },
  },
  {
    id: '16-lecteur-quiz-question',
    titre: 'Lecteur : quiz, une question',
    refs: { 'bureau-clair': '16-lecteur-quiz-question' },
    space: 'demo',
    persona: 'Alice Martin',
    ecarts: [
      'Correction à la fin du quiz, pas après chaque question (décision A) : la question montre les réponses cochées.',
    ],
    async run(page) {
      await activity(page, `${TOGAF}/quiz-m1`);
      await page.getByRole('button', { name: 'Commencer le quiz' }).click();
      const options = page.locator('fieldset.question label');
      await expect(options.first()).toBeVisible();
      await options.nth(0).click();
      await options.nth(2).click();
    },
  },
  {
    id: '17-lecteur-quiz-resultat',
    titre: 'Lecteur : quiz, résultat',
    refs: { 'bureau-clair': '17-lecteur-quiz-resultat' },
    space: 'demo',
    persona: 'Alice Martin',
    ecarts: ['Le résultat reprend la correction de chaque question (décision A).'],
    async run(page) {
      await activity(page, `${TOGAF}/quiz-m1`);
      await page.getByRole('button', { name: 'Commencer le quiz' }).click();
      for (;;) {
        await page.locator('fieldset.question label').first().click();
        const submit = page.getByRole('button', { name: 'Valider mes réponses' });
        if (await submit.isVisible()) {
          await submit.click();
          break;
        }
        await page.getByRole('button', { name: 'Question suivante' }).click();
      }
      await expect(page.locator('article.act .big')).toBeVisible();
    },
  },
  {
    id: '18-lecteur-ordre-verifie',
    titre: 'Lecteur : ordre vérifié (module 3, en aperçu)',
    refs: { 'bureau-clair': '18-lecteur-ordre-verifie' },
    space: 'demo',
    persona: 'Alice Martin',
    ecarts: [
      'Capturé dans l’aperçu de l’évaluation : le module 3 est verrouillé pour un compte de démonstration neuf.',
    ],
    async run(page) {
      await importFixture(page, 'togaf10.formation.json');
      await activity(page, '/administration/evaluation/togaf10/m3-adm/ordre-phases');
      await page.getByRole('button', { name: 'Vérifier' }).click();
      await expect(page.locator('article.act .fb')).toBeVisible();
    },
  },
  {
    id: '19-formation-vue-ensemble',
    titre: 'Vue d’ensemble d’un parcours (Kubernetes)',
    refs: { 'bureau-clair': '19-formation-vue-ensemble' },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await page.goto('/parcours/kubernetes-fondamentaux');
      await heading(page, 'Kubernetes : les fondamentaux');
    },
  },
  {
    id: '20-lecteur-travaux-pratiques',
    titre: 'Lecteur : travaux pratiques',
    refs: { 'bureau-clair': '20-lecteur-travaux-pratiques' },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await activity(page, `${K8S}/tp-premier-conteneur`);
    },
  },
  {
    id: '21-lecteur-lecon-code',
    titre: 'Lecteur : leçon avec encadrés',
    refs: { 'bureau-clair': '21-lecteur-lecon-code' },
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await activity(page, `${K8S}/ca-marche-sur-ma-machine`);
    },
  },
  {
    id: '22-bandeau-production',
    titre: 'Bandeau : production',
    refs: { 'bureau-clair': '22-bandeau-production' },
    space: 'production',
    fullPage: 620,
    async run(page) {
      await page.goto('/catalogue');
      await heading(page, /Se former/);
    },
  },
  {
    id: '23-bandeau-demo',
    titre: 'Bandeau : démonstration',
    refs: { 'bureau-clair': '23-bandeau-demo' },
    space: 'demo',
    persona: 'Alice Martin',
    fullPage: 620,
    async run(page) {
      await page.goto('/catalogue');
      await expect(page.locator('app-course-card')).toHaveCount(7);
    },
  },
  // Écrans de l'application sans capture de référence.
  {
    id: '30-mon-parcours',
    titre: 'Mon parcours en ligne',
    refs: {},
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await page.goto('/parcours');
      await heading(page, 'Mon parcours en ligne');
    },
  },
  {
    id: '31-mon-equipe',
    titre: 'Mon équipe (manager)',
    refs: {},
    space: 'demo',
    persona: 'Chloé Bernard',
    async run(page) {
      await page.goto('/demandes/equipe');
      await expect(page.locator('app-request-card').first()).toBeVisible();
    },
  },
  {
    id: '32-comptes-roles',
    titre: 'Administration › Comptes et rôles',
    refs: {},
    space: 'demo',
    persona: 'Alice Martin',
    async run(page) {
      await page.goto('/administration/comptes');
      await expect(page.locator('table').first()).toBeVisible();
    },
  },
  {
    id: '33-composants',
    titre: 'Bibliothèque de composants',
    refs: {},
    space: 'production',
    async run(page) {
      await page.goto('/administration/composants');
      await expect(page.locator('h1')).toBeVisible();
    },
  },
  {
    id: '34-page-introuvable',
    titre: 'Page introuvable',
    refs: {},
    space: 'production',
    async run(page) {
      await page.goto('/nulle-part');
      await heading(page, 'Page introuvable');
    },
  },
];

async function fixture(name: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  return readFile(`fixtures/formations/${name}`, 'utf8');
}

/** Importe une formation exemple dans l'évaluation, si elle n'y est pas déjà. */
async function importFixture(page: Page, name: string): Promise<void> {
  const res = await page.request.post('/api/formations/import', {
    headers: { 'content-type': 'application/octet-stream' },
    data: Buffer.from(await fixture(name), 'utf8'),
  });
  expect([201, 409]).toContain(res.status());
}
