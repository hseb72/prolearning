import type { FastifyInstance } from 'fastify';
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

type Json = Record<string, any>;

describe.skipIf(!databasesAvailable)('jeu de démonstration et réinitialisation', () => {
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

  const get = (url: string, cookie = admin) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const post = (url: string, payload: object = {}, cookie = admin) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const count = async (table: string, db = databases.demo) =>
    Number((await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);

  it('charge un jeu complet et cohérent', async () => {
    const summary = await loadDemo(databases.demo);
    expect(summary).toEqual({ comptes: 5, formations: 1, fiches: 5, sessions: 7, demandes: 6 });

    await post('/api/space', { space: 'demo' });
    const catalogue = (await get('/api/catalogue')).json();
    expect(catalogue).toHaveLength(5); // l'administrateur joué voit aussi le brouillon
    const togaf = (await get('/api/catalogue/togaf-fondamentaux')).json();
    expect(togaf.formationId).toBe('togaf10');
    expect(togaf.formats).toEqual(['distance', 'site', 'en-ligne']);
    const distance = togaf.sessions.find((s: Json) => s.modalite === 'distance');
    expect(distance).toMatchObject({ places: 8, placesRestantes: 7 });
    expect(new Date(distance.debut).getTime()).toBeGreaterThan(Date.now());

    // Les demandes ont leur historique, signé par les comptes fictifs.
    const file = (await get('/api/demandes/a-traiter')).json();
    expect(file.inscriptions).toHaveLength(1);
    expect(file.inscriptions[0].historique.map((e: Json) => e.par)).toEqual([
      'David Moreau',
      'Chloé Bernard',
    ]);
    expect(file.surMesure.map((d: Json) => d.statut).sort()).toEqual(['a_traiter', 'en_cours']);
    expect((await get('/api/parcours')).json().map((p: Json) => p.id)).toEqual(['togaf10']);
  });

  it('ne recharge pas une base déjà remplie au démarrage', async () => {
    expect(await loadDemo(databases.demo, { onlyIfEmpty: true })).toBeNull();
    expect(await count('pl_courses')).toBe(0);
  });

  it('réinitialise la démonstration sans toucher à la production', async () => {
    await post('/api/catalogue', {
      id: 'prod-seule',
      titre: 'Production',
      theme: 'T',
      resume: 'R',
      publiee: true,
    });
    await post('/api/space', { space: 'demo' });
    // Modifications en démonstration, puis réinitialisation en jouant un collaborateur.
    await post('/api/catalogue', { id: 'ajout-demo', titre: 'Ajout', theme: 'T', resume: 'R' });
    const personas = (await get('/api/space/personas')).json();
    const david = personas.find((p: Json) => p.displayName === 'David Moreau');
    await post('/api/space', { space: 'demo', personaId: david.id });

    const res = await post('/api/demo/reinitialisation');
    expect(res.statusCode).toBe(200);
    expect(res.json().resume.fiches).toBe(5);
    // Le compte joué revient à l'administrateur fictif par défaut.
    expect(res.json().me.actor.displayName).toBe('Alice Martin');

    const demoCourses = await databases.demo.query('SELECT id FROM pl_courses ORDER BY id');
    expect(demoCourses.rows.map((r) => r.id)).not.toContain('ajout-demo');
    expect(demoCourses.rows).toHaveLength(5);
    const prod = await databases.production.query('SELECT id FROM pl_courses');
    expect(prod.rows).toEqual([{ id: 'prod-seule' }]);
    const log = await databases.production.query(
      `SELECT actor_label FROM pl_audit_log WHERE action = 'demo.reset'`,
    );
    expect(log.rows).toEqual([{ actor_label: BOOTSTRAP_ADMIN }]);

    // Deux réinitialisations de suite donnent le même jeu.
    await post('/api/demo/reinitialisation');
    expect(await count('pl_registration_requests')).toBe(4);
    expect(await count('pl_users')).toBe(5);
  });

  it('réserve la réinitialisation aux administrateurs', async () => {
    const lea = await login(app, 'lea@soredi.example');
    expect((await post('/api/demo/reinitialisation', {}, lea)).statusCode).toBe(403);
    expect(
      (await app.inject({ method: 'POST', url: '/api/demo/reinitialisation' })).statusCode,
    ).toBe(401);
  });
});
