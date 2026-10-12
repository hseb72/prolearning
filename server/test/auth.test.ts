import { safeReturnTo } from '../src/auth/routes.js';
import type { Databases } from '../src/databases.js';
import {
  APP_URL,
  BOOTSTRAP_ADMIN,
  closeTestDatabases,
  databasesAvailable,
  login,
  openTestDatabases,
  resetDatabases,
  testApp,
} from './helpers.js';

describe('adresse de retour après connexion', () => {
  it('n’accepte que des chemins internes', () => {
    expect(safeReturnTo('/catalogue?x=1')).toBe('/catalogue?x=1');
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('/\\evil.example')).toBe('/');
    expect(safeReturnTo('https://evil.example')).toBe('/');
    expect(safeReturnTo(undefined)).toBe('/');
  });
});

describe.skipIf(!databasesAvailable)('connexion', () => {
  let databases: Databases;
  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));
  beforeEach(() => resetDatabases(databases));

  it('annonce les modes de connexion proposés', async () => {
    const app = testApp(databases);
    const res = await app.inject({ method: 'GET', url: '/api/auth/config' });
    expect(res.json()).toEqual({ sso: false, devLogin: true });
  });

  it('ouvre une session en production, avec un cookie HttpOnly', async () => {
    const app = testApp(databases);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { email: 'Lea.Dupont@Soredi.example' },
    });
    expect(res.statusCode).toBe(204);
    const cookie = res.cookies.find((c) => c.name === 'pl_session')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `pl_session=${cookie.value}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      user: { email: 'lea.dupont@soredi.example', role: 'employee', displayName: 'lea.dupont' },
      space: 'production',
      canSwitchSpace: false,
    });
    // Le jeton n'est jamais stocké en clair.
    const stored = await databases.production.query('SELECT token_hash FROM pl_sessions');
    expect(stored.rows[0].token_hash).not.toBe(cookie.value);
  });

  it('refuse une session absente ou inventée', async () => {
    const app = testApp(databases);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
    const forged = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: 'pl_session=inventé' },
    });
    expect(forged.statusCode).toBe(401);
  });

  it('n’offre pas la connexion de développement quand elle est désactivée', async () => {
    const app = testApp(databases, { devLogin: false });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { email: 'a@b.example' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('promeut les administrateurs d’amorçage et le journalise', async () => {
    const app = testApp(databases);
    const cookie = await login(app, BOOTSTRAP_ADMIN);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json()).toMatchObject({ user: { role: 'admin' }, canSwitchSpace: true });
    const log = await databases.production.query('SELECT action FROM pl_audit_log ORDER BY id');
    expect(log.rows.map((r) => r.action)).toEqual(['user.bootstrap_admin', 'login']);
  });

  it('ferme la session à la déconnexion', async () => {
    const app = testApp(databases);
    const cookie = await login(app, 'lea@soredi.example');
    const out = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(out.json()).toEqual({ redirect: '/connexion' });
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it('refuse un compte désactivé, même avec une session ouverte', async () => {
    const app = testApp(databases);
    const cookie = await login(app, 'lea@soredi.example');
    await databases.production.query('UPDATE pl_users SET active = false');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it('rejette une requête de modification venant d’une autre origine', async () => {
    const app = testApp(databases);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      headers: { origin: 'https://evil.example' },
      payload: { email: 'lea@soredi.example' },
    });
    expect(res.statusCode).toBe(403);
    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      headers: { origin: APP_URL },
      payload: { email: 'lea@soredi.example' },
    });
    expect(ok.statusCode).toBe(204);
  });
});
