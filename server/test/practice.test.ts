import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Databases } from '../src/databases.js';
import { storeFormation } from '../src/format/store.js';
import { validateFormation } from '../src/format/validate.js';
import {
  closeTestDatabases,
  databasesAvailable,
  login,
  openTestDatabases,
  resetDatabases,
  testApp,
} from './helpers.js';

type Json = Record<string, any>;
const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'formations', name), 'utf8');

describe('formations exemples complètes', () => {
  it.each(['togaf10.formation.json', 'kubernetes-fondamentaux.formation.json'])(
    '%s est valide',
    (name) => {
      const report = validateFormation(fixture(name));
      expect(report.erreurs).toEqual([]);
      expect(report.ok).toBe(true);
    },
  );
});

describe.skipIf(!databasesAvailable)('travaux pratiques (format 1.1)', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let lea: string;
  const source = fixture('kubernetes-fondamentaux.formation.json');
  const formation: Json = JSON.parse(source);

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));

  beforeEach(async () => {
    await resetDatabases(databases);
    for (const name of ['kubernetes-fondamentaux.formation.json', 'togaf10.formation.json']) {
      const text = fixture(name);
      const doc = JSON.parse(text);
      await storeFormation(
        databases.production,
        {
          id: doc.id,
          version: doc.version,
          formatVersion: doc.formatVersion,
          titre: doc.titre,
          theme: doc.theme,
          source: text,
        },
        { allowReplace: false, origin: 'publication', importedBy: null, importedByLabel: 'test' },
      );
    }
    app = testApp(databases);
    lea = await login(app, 'lea@soredi.example');
  });

  const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie: lea } });
  const post = (url: string, payload: object) =>
    app.inject({ method: 'POST', url, headers: { cookie: lea }, payload });

  /** Premier TP de la formation, avec son module. */
  function firstPractice(): { module: Json; activity: Json } {
    for (const module of formation['modules']) {
      const activity = module.activites.find((a: Json) => a.type === 'pratique');
      if (activity) return { module, activity };
    }
    throw new Error('Aucun TP');
  }

  it('montre les deux formations complètes dans le lecteur', async () => {
    const cards = (await get('/api/parcours')).json();
    expect(cards.map((c: Json) => c.id).sort()).toEqual(['kubernetes-fondamentaux', 'togaf10']);
    expect(cards.find((c: Json) => c.id === 'togaf10').modulesTotal).toBe(9);
    const view = (await get('/api/parcours/kubernetes-fondamentaux')).json();
    expect(view.formation.modules).toHaveLength(9);
  });

  it('présente le TP avec ses fichiers, étapes et vérifications', async () => {
    const { module, activity } = firstPractice();
    const view = (await get('/api/parcours/kubernetes-fondamentaux')).json();
    const shown = view.formation.modules
      .find((m: Json) => m.id === module.id)
      .activites.find((a: Json) => a.id === activity.id);
    expect(shown).toMatchObject({
      type: 'pratique',
      objectif: activity.objectif,
      etapes: activity.etapes,
      verification: activity.verification,
      fichiers: activity.fichiers ?? [],
    });
  });

  it('termine le TP quand toute la vérification est cochée', async () => {
    const { module, activity } = firstPractice();
    // Le premier module est ouvert ; le TP est cherché dans un module débloqué.
    const view = (await get('/api/parcours/kubernetes-fondamentaux')).json();
    const url = `/api/parcours/kubernetes-fondamentaux/modules/${module.id}/activites/${activity.id}/pratique`;
    if (!view.progression.modules[module.id].debloque) {
      expect((await post(url, { cochees: [] })).statusCode).toBe(409);
      return;
    }
    const ids = activity.verification.map((v: Json) => v.id);
    const partial = await post(url, { cochees: ids.slice(1) });
    expect(partial.statusCode).toBe(400);
    expect(partial.json().message).toContain('Cochez toutes les vérifications');

    const done = await post(url, { cochees: ids });
    expect(done.statusCode).toBe(200);
    expect(done.json().etat).toMatchObject({ statut: 'faite', points: activity.points ?? 30 });
    const wrong = await post(url.replace('/pratique', '/terminee'), {});
    expect(wrong.statusCode).toBe(400);
  });
});
