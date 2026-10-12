import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Databases } from '../src/databases.js';
import { storeFormation } from '../src/format/store.js';
import { replayScenario } from '../src/learning/grading.js';
import { seededShuffle } from '../src/learning/view.js';
import {
  BOOTSTRAP_ADMIN,
  closeTestDatabases,
  databasesAvailable,
  login,
  openTestDatabases,
  resetDatabases,
  testApp,
} from './helpers.js';

type Json = Record<string, any>;
const FIXTURE = join(
  import.meta.dirname,
  '..',
  '..',
  'fixtures',
  'formations',
  'togaf10-m1.formation.json',
);
const fixture = (): Json => JSON.parse(readFileSync(FIXTURE, 'utf8'));

/** La formation exemple, plus un diaporama, un exercice d'ordre et un second module. */
function richFormation(): Json {
  const f = fixture();
  const m1 = f['modules'][0];
  m1.activites.splice(1, 0, {
    id: 'diapo',
    type: 'diaporama',
    titre: 'Diaporama',
    diapos: [{ image: 'assets/m1/01.png', alt: 'Schéma', explication: 'Le commentaire.' }],
  });
  m1.activites.splice(2, 0, {
    id: 'etapes',
    type: 'ordre',
    titre: 'Remettre dans l’ordre',
    consigne: 'Classez les étapes.',
    elements: [
      { id: 'e1', texte: 'Vision' },
      { id: 'e2', texte: 'Métier' },
      { id: 'e3', texte: 'SI' },
      { id: 'e4', texte: 'Technologie' },
    ],
    explication: 'De la vision à la technologie.',
  });
  f['modules'].push({
    id: 'm2-suite',
    titre: 'Suite',
    resume: 'Deuxième module.',
    objectifs: ['Continuer'],
    dureeEstimeeMinutes: 10,
    activites: [
      {
        id: 'lecture',
        type: 'lecon',
        titre: 'Lecture',
        blocs: [{ type: 'texte', markdown: 'Texte.' }],
      },
    ],
  });
  return f;
}

const at = (f: Json, type: string) =>
  f['modules'][0].activites.find((a: Json) => a['type'] === type);

describe('cas pratique rejoué', () => {
  it('suit le chemin, révèle les points à la fin seulement', () => {
    const scenario = at(fixture(), 'scenario');
    const first = replayScenario(scenario, []);
    expect(first).toHaveProperty('noeud');
    expect(JSON.stringify(first)).not.toContain('points');
    expect(replayScenario(scenario, [99])).toEqual({ error: 'Choix invalide.' });
  });

  it('mélange de façon stable et ne rend jamais l’ordre d’origine', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(seededShuffle(items, 'x')).toEqual(seededShuffle(items, 'x'));
    for (const seed of ['1', '2', '3', '4', '5', '6', '7', '8']) {
      expect(seededShuffle(items, seed)).not.toEqual(items);
    }
  });
});

describe.skipIf(!databasesAvailable)('lecteur de formation et progression', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let lea: string;
  let formation: Json;

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));

  async function publish(f: Json, db = databases.production) {
    const source = JSON.stringify(f, null, 2);
    await storeFormation(
      db,
      {
        id: f['id'],
        version: f['version'],
        formatVersion: '1.0',
        titre: f['titre'],
        theme: f['theme'],
        source,
      },
      { allowReplace: false, origin: 'publication', importedBy: null, importedByLabel: 'test' },
    );
  }

  beforeEach(async () => {
    await resetDatabases(databases);
    app = testApp(databases);
    formation = richFormation();
    await publish(formation);
    lea = await login(app, 'lea@soredi.example');
  });

  const get = (url: string, cookie = lea) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const post = (url: string, payload: object = {}, cookie = lea) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const activity = (module: string, id: string) =>
    `/api/parcours/togaf10/modules/${module}/activites/${id}`;
  const M1 = 'm1-pourquoi-ae';

  async function view(): Promise<Json> {
    return (await get('/api/parcours/togaf10')).json();
  }

  async function passQuiz(cookie = lea): Promise<Json> {
    const quiz = at(formation, 'quiz');
    const attempt = (await post(`${activity(M1, quiz.id)}/quiz/tentative`, {}, cookie)).json();
    const reponses = Object.fromEntries(
      attempt.questions.map((q: Json) => [
        q.id,
        quiz.questions.find((x: Json) => x.id === q.id).bonnes,
      ]),
    );
    return (
      await post(
        `${activity(M1, quiz.id)}/quiz/reponses`,
        { tentative: attempt.tentative, reponses },
        cookie,
      )
    ).json();
  }

  async function bestScenario(): Promise<Json> {
    const scenario = at(formation, 'scenario');
    const chemin: number[] = [];
    let node = scenario.debut;
    while (node !== 'fin') {
      const choix = scenario.noeuds[node].choix as Json[];
      const best = choix.reduce((b, c, i) => (c['points'] > choix[b]!['points'] ? i : b), 0);
      chemin.push(best);
      node = choix[best]!['suivant'];
    }
    return (await post(`${activity(M1, scenario.id)}/scenario`, { chemin })).json();
  }

  it('liste les parcours de l’espace avec la progression de l’apprenant', async () => {
    const cards = (await get('/api/parcours')).json();
    expect(cards).toMatchObject([
      { id: 'togaf10', modulesTotal: 2, modulesTermines: 0, points: 0 },
    ]);
  });

  it('ne transmet aucune réponse attendue au navigateur', async () => {
    const body = (await get('/api/parcours/togaf10')).body;
    for (const secret of [
      '"bonnes"',
      '"questions"',
      '"paires"',
      '"noeuds"',
      '"paliers"',
      '"elements":[{"id"',
      '"consulteLe"',
    ]) {
      expect(body).not.toContain(secret);
    }
    const ordre = (await view()).formation.modules[0].activites.find(
      (a: Json) => a.type === 'ordre',
    );
    expect(ordre.elements.map((e: Json) => e.texte)).not.toEqual([
      'Vision',
      'Métier',
      'SI',
      'Technologie',
    ]);
    expect(ordre.elements.every((e: Json) => /^[\w-]{12}$/.test(e.cle))).toBe(true);
    const quiz = at(formation, 'quiz');
    const attempt = (await post(`${activity(M1, quiz.id)}/quiz/tentative`)).json();
    expect(attempt.questions).toHaveLength(quiz.tirage);
    expect(JSON.stringify(attempt)).not.toMatch(/"bonnes"|"explication"/);
  });

  it('corrige un quiz, garde le meilleur résultat et refuse une tentative rejouée', async () => {
    const quiz = at(formation, 'quiz');
    const attempt = (await post(`${activity(M1, quiz.id)}/quiz/tentative`)).json();
    const wrong = Object.fromEntries(attempt.questions.map((q: Json) => [q.id, ['zz']]));
    const failed = (
      await post(`${activity(M1, quiz.id)}/quiz/reponses`, {
        tentative: attempt.tentative,
        reponses: wrong,
      })
    ).json();
    expect(failed).toMatchObject({
      reussi: false,
      bonnesReponses: 0,
      seuil: 0.8,
      etat: { statut: 'echouee', points: 0 },
    });
    expect(failed.questions[0].explication).toBeTruthy();
    const replay = await post(`${activity(M1, quiz.id)}/quiz/reponses`, {
      tentative: attempt.tentative,
      reponses: wrong,
    });
    expect(replay.statusCode).toBe(409);

    const passed = await passQuiz();
    expect(passed).toMatchObject({
      reussi: true,
      bonnesReponses: 5,
      total: 5,
      etat: { statut: 'reussie', points: 50, score: 1 },
    });
    // Un nouvel échec ne fait pas perdre la réussite.
    const again = (await post(`${activity(M1, quiz.id)}/quiz/tentative`)).json();
    const worse = (
      await post(`${activity(M1, quiz.id)}/quiz/reponses`, {
        tentative: again.tentative,
        reponses: Object.fromEntries(again.questions.map((q: Json) => [q.id, []])),
      })
    ).json();
    expect(worse.etat).toMatchObject({ statut: 'reussie', points: 50 });
  });

  it('corrige l’ordre et l’association à partir des clés opaques', async () => {
    const v = await view();
    const ordre = v.formation.modules[0].activites.find((a: Json) => a.type === 'ordre');
    const wrong = (
      await post(`${activity(M1, 'etapes')}/ordre`, {
        ordre: ordre.elements.map((e: Json) => e.cle),
      })
    ).json();
    expect(wrong.juste).toBe(false);
    const right = (await post(`${activity(M1, 'etapes')}/ordre`, { ordre: wrong.solution })).json();
    expect(right).toMatchObject({ juste: true, etat: { points: 30 } });

    const assoc = v.formation.modules[0].activites.find((a: Json) => a.type === 'association');
    const pairs = at(formation, 'association').paires as Json[];
    const reponses = Object.fromEntries(
      assoc.gauches.map((g: Json, i: number) => [g.cle, pairs[i]!['droite']]),
    );
    expect(
      (await post(`${activity(M1, assoc.id)}/association`, { reponses })).json(),
    ).toMatchObject({
      juste: true,
      etat: { points: 20 },
    });
  });

  it('termine le module, accorde le bonus, débloque la suite et les badges', async () => {
    expect((await post(`${activity('m2-suite', 'lecture')}/terminee`)).statusCode).toBe(409);

    for (const a of formation['modules'][0].activites as Json[]) {
      if (['lecon', 'diaporama', 'fiches'].includes(a['type']))
        await post(`${activity(M1, a['id'])}/terminee`);
    }
    await post(`${activity(M1, 'etapes')}/ordre`, { ordre: [] });
    const assoc = (await view()).formation.modules[0].activites.find(
      (a: Json) => a.type === 'association',
    );
    await post(`${activity(M1, assoc.id)}/association`, { reponses: {} });
    const stars = await bestScenario();
    expect(stars.fin).toMatchObject({
      etoiles: 3,
      points: expect.any(Number),
      etat: { points: 60 },
    });
    const quiz = await passQuiz();
    expect(quiz.moduleTermine).toBe(true);

    const state = (await view()).progression;
    expect(state.modules).toEqual({
      [M1]: { debloque: true, termine: true },
      'm2-suite': { debloque: true, termine: false },
    });
    const done = await post(`${activity('m2-suite', 'lecture')}/terminee`);
    expect(done.json()).toEqual({
      etat: { statut: 'faite', points: 10, score: null },
      moduleTermine: true,
    });

    const profile = (await get('/api/parcours/profil')).json();
    expect(profile.badges).toEqual([
      'premier-pas',
      'module-termine',
      'sans-faute',
      'stratege',
      'parcours-termine',
    ]);
    expect(profile.points).toBe((await view()).progression.points);
    expect(profile.points).toBeGreaterThanOrEqual(100);
    expect(profile.niveau.niveau.nom).not.toBe('Découverte');
  });

  it('conserve la progression d’une version à l’autre tant que les identifiants restent', async () => {
    await post(`${activity(M1, 'probleme')}/terminee`);
    await post(`${activity(M1, 'definition')}/terminee`);
    const next = richFormation();
    next['version'] = '0.2.0';
    next['modules'][0].activites.find((a: Json) => a['id'] === 'definition').id = 'definition-v2';
    await publish(next);
    const progress = (await view()).progression.activites[M1];
    expect(progress['probleme'].statut).toBe('faite');
    expect(progress['definition-v2'].statut).toBe('a-faire');
    expect(progress['definition']).toBeUndefined();
  });

  it('tient la progression de chaque espace dans sa base', async () => {
    await post(`${activity(M1, 'probleme')}/terminee`);
    const admin = await login(app, BOOTSTRAP_ADMIN);
    await post('/api/space', { space: 'demo' }, admin);
    // En démonstration, la formation n'existe pas encore : rien à lire, rien à écrire.
    expect((await get('/api/parcours', admin)).json()).toEqual([]);
    await publish(richFormation(), databases.demo);
    expect((await get('/api/parcours', admin)).json()[0].points).toBe(0);
    const demoRows = await databases.demo.query('SELECT 1 FROM pl_activity_results');
    expect(demoRows.rowCount).toBe(0);
  });

  it('refuse une activité inconnue ou une action sans rapport', async () => {
    expect((await post(`${activity(M1, 'inconnue')}/terminee`)).statusCode).toBe(404);
    expect((await post(`${activity(M1, at(formation, 'quiz').id)}/terminee`)).statusCode).toBe(400);
    expect((await get('/api/parcours/inconnue')).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/parcours' })).statusCode).toBe(401);
  });
});
