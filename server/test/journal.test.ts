import type { FastifyInstance } from 'fastify';
import { audit } from '../src/audit.js';
import type { Databases } from '../src/databases.js';
import {
  BOOTSTRAP_ADMIN,
  closeTestDatabases,
  databasesAvailable,
  login,
  openTestDatabases,
  resetDatabases,
  testApp,
} from './helpers.js';

describe.skipIf(!databasesAvailable)('journal d’audit', () => {
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

  const journal = (query = '', cookie = admin) =>
    app.inject({ method: 'GET', url: `/api/journal${query}`, headers: { cookie } });

  it('est réservé aux administrateurs', async () => {
    const lea = await login(app, 'lea@soredi.example');
    expect((await journal('', lea)).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/journal' })).statusCode).toBe(401);
  });

  it('liste les actions de la plus récente à la plus ancienne, filtrées par famille', async () => {
    for (const action of ['course.create', 'session.create', 'course.update'] as const) {
      await audit(databases.production, {
        actorId: null,
        actorLabel: 'equipe@soredi.example',
        action,
        details: { courseId: 'togaf' },
      });
    }
    const all = (await journal()).json();
    expect(all.entries[0]).toMatchObject({
      action: 'course.update',
      actorLabel: 'equipe@soredi.example',
      details: { courseId: 'togaf' },
    });
    // Connexion et promotion de l'administrateur d'amorçage, plus les trois actions.
    expect(all.entries.map((e: { action: string }) => e.action)).toContain('login');
    const courses = (await journal('?famille=course')).json();
    expect(courses.entries.map((e: { action: string }) => e.action)).toEqual([
      'course.update',
      'course.create',
    ]);
    const logins = (await journal('?famille=login')).json();
    expect(logins.entries.every((e: { action: string }) => e.action === 'login')).toBe(true);
    expect((await journal('?famille=inconnue')).statusCode).toBe(400);
  });

  it('se lit par pages de 50', async () => {
    for (let i = 0; i < 60; i++) {
      await audit(databases.production, {
        actorId: null,
        actorLabel: null,
        action: 'session.update',
        details: { n: i },
      });
    }
    const first = (await journal('?famille=session')).json();
    expect(first.entries).toHaveLength(50);
    expect(first.entries[0].details).toEqual({ n: 59 });
    const second = (await journal(`?famille=session&avant=${first.next}`)).json();
    expect(second.entries).toHaveLength(10);
    expect(second.entries.at(-1).details).toEqual({ n: 0 });
    expect(second.next).toBeNull();
  });

  it('ne montre que le journal de l’espace actif', async () => {
    await audit(databases.demo, {
      actorId: null,
      actorLabel: null,
      action: 'course.create',
      details: { espace: 'demo' },
    });
    const production = (await journal('?famille=course')).json();
    expect(production.entries).toEqual([]);
    await app.inject({
      method: 'POST',
      url: '/api/space',
      headers: { cookie: admin },
      payload: { space: 'demo' },
    });
    const demo = (await journal('?famille=course')).json();
    expect(demo.entries.map((e: { details: unknown }) => e.details)).toEqual([{ espace: 'demo' }]);
  });
});
