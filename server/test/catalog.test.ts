import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Databases } from '../src/databases.js';
import { storeFormation } from '../src/format/store.js';
import {
  BOOTSTRAP_ADMIN,
  closeTestDatabases,
  databasesAvailable,
  login,
  openTestDatabases,
  promote,
  resetDatabases,
  testApp,
} from './helpers.js';

type Json = Record<string, any>;

const DAY = 24 * 3600 * 1000;
const inDays = (days: number, hours = 9) => {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hours, 0, 0, 0);
  return d.toISOString();
};

const COURSE = {
  id: 'togaf-fondamentaux',
  titre: 'TOGAF : les fondamentaux',
  theme: 'Architecture',
  resume: 'Deux jours pour **comprendre** TOGAF.',
  objectifs: ['Situer TOGAF', 'Conduire un cycle ADM'],
  public: 'Architectes',
  prerequis: 'Aucun',
  dureeHeures: 14,
  formationId: null,
  publiee: true,
};

const SESSION = {
  modalite: 'site',
  debut: inDays(10, 7),
  fin: inDays(11, 15),
  lieu: 'Lyon, salle Confluence',
  formateur: 'Claire Dubois',
  places: 8,
};

describe.skipIf(!databasesAvailable)('catalogue et sessions', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let lea: string;
  let equipe: string;

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));

  beforeEach(async () => {
    await resetDatabases(databases);
    app = testApp(databases);
    lea = await login(app, 'lea@soredi.example');
    await login(app, 'formation@soredi.example');
    await promote(databases, 'formation@soredi.example', 'training');
    equipe = await login(app, 'formation@soredi.example');
  });

  const get = (url: string, cookie = lea) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const send = (method: 'POST' | 'PUT', url: string, payload: object, cookie = equipe) =>
    app.inject({ method, url, headers: { cookie }, payload });

  async function createCourse(course: Json = COURSE): Promise<Json> {
    const res = await send('POST', '/api/catalogue', course);
    expect(res.statusCode).toBe(201);
    return res.json();
  }
  async function addSession(session: Json = SESSION, course = COURSE.id): Promise<Json> {
    const res = await send('POST', `/api/catalogue/${course}/sessions`, session);
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  it('publie une fiche et ses sessions aux collaborateurs', async () => {
    await createCourse();
    const distance = await addSession({
      ...SESSION,
      modalite: 'distance',
      debut: inDays(3),
      fin: inDays(3, 12),
      lieu: 'Teams',
    });
    await addSession();

    const cards = (await get('/api/catalogue')).json();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: COURSE.id,
      formats: ['distance', 'site'],
      prochaineSession: distance.debut,
      dureeHeures: 14,
    });

    const detail = (await get(`/api/catalogue/${COURSE.id}`)).json();
    expect(detail.objectifs).toEqual(COURSE.objectifs);
    expect(detail.sessions.map((s: Json) => s.modalite)).toEqual(['distance', 'site']);
    expect(detail.sessions[1]).toMatchObject({ places: 8, placesRestantes: 8, annulee: false });

    const agenda = (await get('/api/sessions')).json();
    expect(agenda.map((s: Json) => s.courseTitre)).toEqual([COURSE.titre, COURSE.titre]);
  });

  it('cache les brouillons, les sessions passées et annulées aux collaborateurs', async () => {
    await createCourse({ ...COURSE, id: 'brouillon', publiee: false });
    await createCourse();
    const past = await addSession({ ...SESSION, debut: inDays(-5), fin: inDays(-5, 17) });
    const cancelled = await addSession();
    const open = await addSession({ ...SESSION, debut: inDays(20), fin: inDays(20, 17) });
    const res = await send('POST', `/api/sessions/${cancelled.id}/annulation`, {});
    expect(res.json().annulee).toBe(true);

    expect((await get('/api/catalogue')).json().map((c: Json) => c.id)).toEqual([COURSE.id]);
    expect((await get('/api/catalogue/brouillon')).statusCode).toBe(404);
    const seen = (await get(`/api/catalogue/${COURSE.id}`)).json().sessions;
    expect(seen.map((s: Json) => s.id)).toEqual([open.id]);
    expect((await get('/api/sessions')).json().map((s: Json) => s.id)).toEqual([open.id]);

    // L'équipe formation voit tout, pour gérer.
    expect((await get('/api/catalogue', equipe)).json()).toHaveLength(2);
    const all = (await get(`/api/catalogue/${COURSE.id}`, equipe)).json().sessions;
    expect(all.map((s: Json) => s.id)).toEqual([past.id, cancelled.id, open.id]);
  });

  it('compte les places restantes à partir des inscriptions confirmées', async () => {
    await createCourse();
    const session = await addSession({ ...SESSION, places: 2 });
    const users = await databases.production.query<{ id: string }>(
      'SELECT id FROM pl_users ORDER BY id',
    );
    await databases.production.query(
      `INSERT INTO pl_session_registrations (session_id, user_id, statut)
       VALUES ($1, $2, 'confirmee'), ($1, $3, 'annulee')`,
      [session.id, users.rows[0]!.id, users.rows[1]!.id],
    );
    const seen = (await get(`/api/catalogue/${COURSE.id}`)).json().sessions[0];
    expect(seen.placesRestantes).toBe(1);

    // La capacité ne descend pas sous les places prises.
    const shrink = await send('PUT', `/api/sessions/${session.id}`, { ...SESSION, places: 0 });
    expect(shrink.statusCode).toBe(400);
    await databases.production.query(
      `UPDATE pl_session_registrations SET statut = 'confirmee' WHERE session_id = $1`,
      [session.id],
    );
    const tooSmall = await send('PUT', `/api/sessions/${session.id}`, { ...SESSION, places: 1 });
    expect(tooSmall.statusCode).toBe(409);
    const ok = await send('PUT', `/api/sessions/${session.id}`, { ...SESSION, places: 5 });
    expect(ok.json()).toMatchObject({ places: 5, placesRestantes: 3 });
  });

  it('associe un parcours en ligne disponible dans l’espace', async () => {
    const fixture = readFileSync(
      join(import.meta.dirname, '..', '..', 'fixtures', 'formations', 'togaf10-m1.formation.json'),
      'utf8',
    );
    await storeFormation(
      databases.production,
      {
        id: 'togaf10',
        version: '0.1.0',
        formatVersion: '1.0',
        titre: 'TOGAF 10',
        theme: 'Architecture',
        source: fixture,
      },
      { allowReplace: false, origin: 'publication', importedBy: null, importedByLabel: 'test' },
    );
    const missing = await send('POST', '/api/catalogue', { ...COURSE, formationId: 'inconnue' });
    expect(missing.statusCode).toBe(409);

    const options = (await get('/api/catalogue-parcours', equipe)).json();
    expect(options.map((o: Json) => o.id)).toEqual(['togaf10']);
    const course = await createCourse({ ...COURSE, formationId: 'togaf10' });
    expect(course).toMatchObject({ formationId: 'togaf10', formats: ['en-ligne'] });
  });

  it('modifie une fiche et journalise la gestion', async () => {
    await createCourse();
    const session = await addSession();
    const res = await send('PUT', `/api/catalogue/${COURSE.id}`, {
      ...COURSE,
      id: undefined,
      titre: 'TOGAF : l’essentiel',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().titre).toBe('TOGAF : l’essentiel');
    await send('POST', `/api/sessions/${session.id}/annulation`, {});
    const edit = await send('PUT', `/api/sessions/${session.id}`, SESSION);
    expect(edit.statusCode).toBe(409);

    const log = await databases.production.query<{ action: string }>(
      'SELECT action FROM pl_audit_log WHERE action LIKE $1 ORDER BY id',
      ['course.%'],
    );
    expect(log.rows.map((r) => r.action)).toEqual(['course.create', 'course.update']);
    const sessions = await databases.production.query<{ action: string }>(
      `SELECT action FROM pl_audit_log WHERE action LIKE 'session.%' ORDER BY id`,
    );
    expect(sessions.rows.map((r) => r.action)).toEqual(['session.create', 'session.cancel']);
  });

  it('refuse la gestion aux collaborateurs et les saisies invalides', async () => {
    expect((await send('POST', '/api/catalogue', COURSE, lea)).statusCode).toBe(403);
    expect((await get('/api/catalogue-parcours')).statusCode).toBe(403);
    expect(
      (await send('POST', '/api/catalogue', { ...COURSE, id: 'Pas Un Slug' })).statusCode,
    ).toBe(400);
    await createCourse();
    expect((await send('POST', '/api/catalogue', COURSE)).statusCode).toBe(409);
    const backwards = await send('POST', `/api/catalogue/${COURSE.id}/sessions`, {
      ...SESSION,
      fin: SESSION.debut,
    });
    expect(backwards.statusCode).toBe(400);
    const session = await addSession();
    expect((await send('POST', `/api/sessions/${session.id}/annulation`, {}, lea)).statusCode).toBe(
      403,
    );
    expect((await get('/api/catalogue/inconnue')).statusCode).toBe(404);
    expect((await send('PUT', '/api/sessions/999', SESSION)).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/catalogue' })).statusCode).toBe(401);
  });

  it('tient le catalogue de chaque espace dans sa base', async () => {
    await createCourse();
    const admin = await login(app, BOOTSTRAP_ADMIN);
    await send('POST', '/api/space', { space: 'demo' }, admin);
    // En démonstration, l'administrateur joue un compte fictif administrateur.
    expect((await get('/api/catalogue', admin)).json()).toEqual([]);
    expect(
      (await send('POST', '/api/catalogue', { ...COURSE, id: 'demo-only' }, admin)).statusCode,
    ).toBe(201);
    const prod = await databases.production.query('SELECT id FROM pl_courses');
    expect(prod.rows).toEqual([{ id: COURSE.id }]);
    const demo = await databases.demo.query('SELECT id FROM pl_courses');
    expect(demo.rows).toEqual([{ id: 'demo-only' }]);
    expect((await get('/api/catalogue')).json().map((c: Json) => c.id)).toEqual([COURSE.id]);
  });
});
