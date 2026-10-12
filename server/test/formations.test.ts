import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { compareSemver, decide } from '../src/format/store.js';
import type { Databases } from '../src/databases.js';
import { loadDemo } from '../src/demo.js';
import {
  BOOTSTRAP_ADMIN,
  closeTestDatabases,
  databasesAvailable,
  login,
  openTestDatabases,
  resetDatabases,
  testApp,
} from './helpers.js';

const FIXTURE = join(
  import.meta.dirname,
  '..',
  '..',
  'fixtures',
  'formations',
  'togaf10-m1.formation.json',
);
const original = readFileSync(FIXTURE);
const withVersion = (version: string): Buffer => {
  const f = JSON.parse(original.toString('utf8'));
  f.version = version;
  return Buffer.from(JSON.stringify(f, null, 2), 'utf8');
};

describe('règles de version (§ 11)', () => {
  it('compare les versions numériquement', () => {
    expect(compareSemver('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('0.1.0', '0.1.0')).toBe(0);
  });

  it('applique les quatre cas du § 11', () => {
    expect(decide(null, '1.0.0', false)).toEqual({ action: 'nouvelle' });
    const existing = { current: '1.2.0', versions: ['1.0.0', '1.2.0'] };
    expect(decide(existing, '1.3.0', false)).toEqual({ action: 'nouvelle-version' });
    expect(decide(existing, '1.2.0', false)).toHaveProperty('refus');
    expect(decide(existing, '1.2.0', true)).toEqual({ action: 'remplacement' });
    expect(decide(existing, '1.1.0', false)).toHaveProperty('refus');
  });
});

describe.skipIf(!databasesAvailable)('évaluation, publication et copie des formations', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let admin: string;

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));
  beforeEach(async () => {
    await resetDatabases(databases);
    app = testApp(databases);
    admin = await login(app, BOOTSTRAP_ADMIN);
  });

  const toDemo = (personaId?: number) =>
    app.inject({
      method: 'POST',
      url: '/api/space',
      headers: { cookie: admin },
      payload: { space: 'demo', personaId },
    });
  const toProduction = () =>
    app.inject({
      method: 'POST',
      url: '/api/space',
      headers: { cookie: admin },
      payload: { space: 'production' },
    });
  const upload = (file: Buffer, query = '', cookie = admin) =>
    app.inject({
      method: 'POST',
      url: `/api/formations/import${query}`,
      headers: { cookie, 'content-type': 'application/octet-stream' },
      payload: file,
    });
  const list = () =>
    app.inject({ method: 'GET', url: '/api/formations', headers: { cookie: admin } });
  const exportVersion = (version: string) =>
    app.inject({
      method: 'GET',
      url: `/api/formations/togaf10/versions/${version}/export`,
      headers: { cookie: admin },
    });
  const publish = (version: string) =>
    app.inject({
      method: 'POST',
      url: `/api/formations/togaf10/versions/${version}/publication`,
      headers: { cookie: admin },
    });
  const copyToDemo = (version: string) =>
    app.inject({
      method: 'POST',
      url: `/api/formations/togaf10/versions/${version}/copie-demo`,
      headers: { cookie: admin },
    });
  const ids = async (db: keyof Databases) =>
    (await databases[db].query('SELECT id FROM pl_formations ORDER BY id')).rows.map((r) => r.id);

  it('valide un fichier sans l’importer, et rend un rapport lisible', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/formations/validation',
      headers: { cookie: admin, 'content-type': 'application/octet-stream' },
      payload: Buffer.from('{"format":"3s-formation"}'),
    });
    expect(res.statusCode).toBe(200);
    const report = res.json();
    expect(report.ok).toBe(false);
    expect(report.erreurs).toContainEqual({ chemin: '', message: 'requiert la propriété modules' });
  });

  it('importe en évaluation, quel que soit l’espace actif, et nulle part ailleurs', async () => {
    expect((await upload(original)).statusCode).toBe(201);
    await toDemo();
    expect((await upload(withVersion('0.2.0'))).statusCode).toBe(201);
    expect(await ids('evaluation')).toEqual(['togaf10']);
    expect(await ids('production')).toEqual([]);
    expect(await ids('demo')).toEqual([]);
    // La liste de l'administration est celle de l'évaluation, vue de l'un ou l'autre espace.
    await toProduction();
    expect((await list()).json()[0].versionCourante).toBe('0.2.0');
  });

  it('importe la formation exemple et la réexporte octet pour octet', async () => {
    const res = await upload(original);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ importee: true, action: 'nouvelle', rapport: { ok: true } });

    const exported = await exportVersion('0.1.0');
    expect(exported.statusCode).toBe(200);
    expect(exported.headers['content-disposition']).toBe(
      'attachment; filename="togaf10-0.1.0.formation.json"',
    );
    expect(exported.rawPayload.equals(original)).toBe(true);
    expect(JSON.parse(exported.body)).toEqual(JSON.parse(original.toString('utf8')));

    const rows = list();
    expect((await rows).json()).toMatchObject([
      { id: 'togaf10', versionCourante: '0.1.0', titre: "Architecture d'entreprise avec TOGAF 10" },
    ]);
  });

  it('applique les règles de version et journalise chaque import', async () => {
    expect((await upload(original)).statusCode).toBe(201);
    const same = await upload(original);
    expect(same.statusCode).toBe(409);
    expect(same.json().refus).toMatch(/existe déjà/);
    expect((await upload(original, '?remplacer=oui')).json().action).toBe('remplacement');
    expect((await upload(withVersion('0.2.0'))).json().action).toBe('nouvelle-version');
    const lower = await upload(withVersion('0.1.5'));
    expect(lower.statusCode).toBe(409);
    expect(lower.json().refus).toMatch(/inférieure/);

    const row = (await list()).json()[0];
    expect(row.versionCourante).toBe('0.2.0');
    expect(row.versions.map((v: { version: string }) => v.version)).toEqual(['0.2.0', '0.1.0']);

    // Journal permanent, en production : qui, quand, quelle version.
    const log = await databases.production.query(
      "SELECT actor_label, details FROM pl_audit_log WHERE action = 'formation.import' ORDER BY id",
    );
    expect(log.rows.map((r) => r.details.action)).toEqual([
      'nouvelle',
      'remplacement',
      'nouvelle-version',
    ]);
    expect(log.rows[0].actor_label).toBe(BOOTSTRAP_ADMIN);
    expect(row.versions[0].importedBy).toBe(BOOTSTRAP_ADMIN);
  });

  it('refuse un fichier invalide avec son rapport', async () => {
    const res = await upload(Buffer.from('{ pas du json'));
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ importee: false, rapport: { ok: false } });
    expect((await list()).json()).toEqual([]);
  });

  it('réserve l’import aux administrateurs, y compris au compte joué', async () => {
    const lea = await login(app, 'lea@soredi.example');
    expect((await upload(original, '', lea)).statusCode).toBe(403);
    const personas = (
      await app.inject({ method: 'GET', url: '/api/space/personas', headers: { cookie: admin } })
    ).json() as { id: number; role: string }[];
    await toDemo(personas.find((p) => p.role === 'employee')!.id);
    expect((await upload(original)).statusCode).toBe(403);
  });

  it('publie en production depuis l’évaluation, sans perte et une seule fois', async () => {
    await upload(original);
    // Avant publication, la production ne voit rien.
    expect(await ids('production')).toEqual([]);

    const published = await publish('0.1.0');
    expect(published.statusCode).toBe(201);
    expect(published.json()).toEqual({ publiee: true, action: 'nouvelle' });
    expect((await list()).json()[0].versions[0].publishedAt).not.toBeNull();
    const again = await publish('0.1.0');
    expect(again.statusCode).toBe(409);
    expect(again.json().refus).toMatch(/existe déjà/);

    const production = await databases.production.query(
      'SELECT origin, imported_by_label, source FROM pl_formation_versions',
    );
    expect(production.rows).toEqual([
      { origin: 'publication', imported_by_label: BOOTSTRAP_ADMIN, source: original.toString() },
    ]);

    const log = await databases.production.query(
      "SELECT actor_label, details FROM pl_audit_log WHERE action = 'formation.publish'",
    );
    expect(log.rows).toEqual([
      {
        actor_label: BOOTSTRAP_ADMIN,
        details: { id: 'togaf10', version: '0.1.0', action: 'nouvelle' },
      },
    ]);
  });

  it('refuse la publication à un compte joué qui n’est pas administrateur', async () => {
    await upload(original);
    const personas = (
      await app.inject({ method: 'GET', url: '/api/space/personas', headers: { cookie: admin } })
    ).json() as { id: number; role: string }[];
    await toDemo(personas.find((p) => p.role === 'training')!.id);
    expect((await publish('0.1.0')).statusCode).toBe(403);
    expect((await databases.production.query('SELECT 1 FROM pl_formations')).rowCount).toBe(0);
  });

  it('copie en démonstration ; la réinitialisation efface la copie, pas l’original', async () => {
    await upload(original);
    const copy = await copyToDemo('0.1.0');
    expect(copy.statusCode).toBe(201);
    expect(copy.json()).toEqual({ copiee: true });
    // Recopier une version corrigée est permis en démonstration.
    expect((await copyToDemo('0.1.0')).statusCode).toBe(201);
    expect(await ids('demo')).toEqual(['togaf10']);
    expect((await list()).json()[0].versions[0].copiedToDemoAt).not.toBeNull();
    const demo = await databases.demo.query('SELECT origin FROM pl_formation_versions');
    expect(demo.rows).toEqual([{ origin: 'copie' }]);

    await toDemo();
    expect(
      (await app.inject({ method: 'GET', url: '/api/parcours', headers: { cookie: admin } }))
        .json()
        .map((p: { id: string }) => p.id),
    ).toEqual(['togaf10']);

    // Réinitialisation : la démonstration retrouve la formation de son jeu, pas la copie.
    await loadDemo(databases.demo);
    const after = await databases.demo.query('SELECT origin FROM pl_formation_versions');
    expect(after.rows).toEqual([{ origin: 'import' }]);
    expect(await ids('evaluation')).toEqual(['togaf10']);
    expect((await exportVersion('0.1.0')).rawPayload.equals(original)).toBe(true);
  });

  it('isole les trois espaces : réinitialiser la démo pendant un import ne touche pas l’évaluation', async () => {
    await upload(original);
    await publish('0.1.0');
    // Un import et une réinitialisation de la démo, en même temps.
    const [imported] = await Promise.all([upload(withVersion('0.2.0')), loadDemo(databases.demo)]);
    expect(imported.statusCode).toBe(201);
    const versions = await databases.evaluation.query(
      'SELECT version FROM pl_formation_versions ORDER BY version',
    );
    expect(versions.rows.map((r) => r.version)).toEqual(['0.1.0', '0.2.0']);
    // La démonstration a son jeu de départ, la production sa version publiée.
    expect(await ids('demo')).toEqual(['togaf10']);
    const demoOrigin = await databases.demo.query('SELECT origin FROM pl_formation_versions');
    expect(demoOrigin.rows).toEqual([{ origin: 'import' }]);
    const prod = await databases.production.query('SELECT version FROM pl_formation_versions');
    expect(prod.rows).toEqual([{ version: '0.1.0' }]);
  });

  it('fait relire la formation en évaluation dans le lecteur, sans rien enregistrer', async () => {
    await upload(original);
    const get = (url: string, cookie = admin) =>
      app.inject({ method: 'GET', url, headers: { cookie } });
    const post = (url: string, payload: object) =>
      app.inject({ method: 'POST', url, headers: { cookie: admin }, payload });

    const view = (await get('/api/evaluation/parcours/togaf10')).json();
    expect(view.formation.id).toBe('togaf10');
    expect(Object.values(view.progression.modules)).toEqual([{ debloque: true, termine: false }]);
    // Pas de fuite des réponses dans l'aperçu non plus.
    expect(JSON.stringify(view)).not.toContain('"bonnes"');

    const quizUrl =
      '/api/evaluation/parcours/togaf10/modules/m1-pourquoi-ae/activites/quiz-m1/quiz';
    const attempt = (await post(`${quizUrl}/tentative`, {})).json();
    expect(attempt.questions).toHaveLength(5);
    const quiz = JSON.parse(original.toString()).modules[0].activites.find(
      (a: { id: string }) => a.id === 'quiz-m1',
    );
    const reponses = Object.fromEntries(
      attempt.questions.map((q: { id: string }) => [
        q.id,
        quiz.questions.find((x: { id: string }) => x.id === q.id).bonnes,
      ]),
    );
    const corrected = (await post(`${quizUrl}/reponses`, { tentative: 0, reponses })).json();
    expect(corrected).toMatchObject({ reussi: true, bonnesReponses: 5, moduleTermine: false });

    const done = await post(
      '/api/evaluation/parcours/togaf10/modules/m1-pourquoi-ae/activites/probleme/terminee',
      {},
    );
    expect(done.json().etat.statut).toBe('faite');
    for (const db of ['production', 'demo', 'evaluation'] as const) {
      const rows = await databases[db].query('SELECT 1 FROM pl_activity_results');
      expect(rows.rowCount).toBe(0);
    }

    // Réservé aux administrateurs.
    const lea = await login(app, 'lea@soredi.example');
    expect((await get('/api/evaluation/parcours/togaf10', lea)).statusCode).toBe(403);
  });
});
