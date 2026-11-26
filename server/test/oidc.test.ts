import { OAuth2Server } from 'oauth2-mock-server';
import { OidcLogin } from '../src/auth/oidc.js';
import type { Databases } from '../src/databases.js';
import {
  APP_URL,
  closeTestDatabases,
  databasesAvailable,
  openTestDatabases,
  resetDatabases,
  testApp,
} from './helpers.js';

/** Parcours de connexion complet contre un faux Keycloak (serveur OIDC de test). */
describe.skipIf(!databasesAvailable)('connexion SSO', () => {
  let databases: Databases;
  let server: OAuth2Server;
  let oidc: OidcLogin;

  beforeAll(async () => {
    databases = openTestDatabases();
    server = new OAuth2Server();
    await server.issuer.keys.generate('RS256');
    await server.start(0, 'localhost');
    oidc = new OidcLogin(
      { issuer: server.issuer.url!, clientId: 'prolearning', clientSecret: 'secret' },
      `${APP_URL}/api/auth/callback`,
      { allowInsecureIssuer: true },
    );
    server.service.on('beforeTokenSigning', (token) => {
      token.payload.sub = 'kc-123';
      token.payload.email = 'lea.dupont@soredi.example';
      token.payload.name = 'Léa Dupont';
    });
  });
  afterAll(async () => {
    await server.stop();
    await closeTestDatabases(databases);
  });
  beforeEach(() => resetDatabases(databases));

  /** Suit la redirection vers le faux Keycloak, qui approuve d'office et renvoie le code. */
  async function authorize(location: string): Promise<string> {
    const res = await fetch(location, { redirect: 'manual' });
    const back = res.headers.get('location');
    if (!back) throw new Error(`Pas de retour du serveur OIDC (${res.status}).`);
    const url = new URL(back);
    return url.pathname + url.search;
  }

  it('crée le compte, ouvre la session et revient à la page demandée', async () => {
    const app = testApp(databases, { oidc });
    const start = await app.inject({ method: 'GET', url: '/api/auth/login?retour=/catalogue' });
    expect(start.statusCode).toBe(302);
    const location = new URL(start.headers.location as string);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('redirect_uri')).toBe(`${APP_URL}/api/auth/callback`);

    const callback = await app.inject({ method: 'GET', url: await authorize(location.href) });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe('/catalogue');
    const cookie = callback.cookies.find((c) => c.name === 'pl_session')!;

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: `pl_session=${cookie.value}` },
    });
    expect(me.json()).toMatchObject({
      user: { displayName: 'Léa Dupont', email: 'lea.dupont@soredi.example', role: 'employee' },
    });
    const stored = await databases.production.query('SELECT oidc_subject FROM pl_users');
    expect(stored.rows).toEqual([{ oidc_subject: 'kc-123' }]);
  });

  it('n’accepte qu’une fois le retour d’une même connexion', async () => {
    const app = testApp(databases, { oidc });
    const start = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const callbackPath = await authorize(start.headers.location as string);
    expect((await app.inject({ method: 'GET', url: callbackPath })).headers.location).toBe('/');
    const replay = await app.inject({ method: 'GET', url: callbackPath });
    expect(replay.headers.location).toBe('/connexion?erreur=sso-refuse');
  });

  it('refuse un retour dont l’état est inconnu', async () => {
    const app = testApp(databases, { oidc });
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/callback?code=abc&state=inconnu',
    });
    expect(res.headers.location).toBe('/connexion?erreur=sso-refuse');
    expect(res.cookies.find((c) => c.name === 'pl_session')).toBeUndefined();
  });

  it('rattache la connexion SSO à un compte créé à l’avance avec la même adresse', async () => {
    await databases.production.query(
      "INSERT INTO pl_users (email, display_name, role) VALUES ('Lea.Dupont@soredi.example', 'Léa', 'manager')",
    );
    const app = testApp(databases, { oidc });
    const start = await app.inject({ method: 'GET', url: '/api/auth/login' });
    await app.inject({ method: 'GET', url: await authorize(start.headers.location as string) });
    const users = await databases.production.query('SELECT oidc_subject, role FROM pl_users');
    expect(users.rows).toEqual([{ oidc_subject: 'kc-123', role: 'manager' }]);
  });

  it('fait changer le mot de passe par Keycloak et garde la session en cours', async () => {
    const app = testApp(databases, { oidc });
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const first = await app.inject({
      method: 'GET',
      url: await authorize(login.headers.location as string),
    });
    const cookie = `pl_session=${first.cookies.find((c) => c.name === 'pl_session')!.value}`;
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json()).toMatchObject({ sso: true });

    const start = await app.inject({
      method: 'GET',
      url: '/api/auth/mot-de-passe',
      headers: { cookie },
    });
    expect(start.statusCode).toBe(302);
    const location = new URL(start.headers.location as string);
    expect(location.searchParams.get('kc_action')).toBe('UPDATE_PASSWORD');

    // Keycloak ajoute l'issue de l'action à son retour.
    const back = await app.inject({
      method: 'GET',
      url: `${await authorize(location.href)}&kc_action_status=success`,
      headers: { cookie },
    });
    expect(back.headers.location).toBe('/mes-donnees?motdepasse=modifie');
    expect(back.cookies.find((c) => c.name === 'pl_session')).toBeUndefined();
    const sessions = await databases.production.query('SELECT count(*)::int AS n FROM pl_sessions');
    expect(sessions.rows[0].n).toBe(1);
  });

  it('signale un changement de mot de passe abandonné', async () => {
    const app = testApp(databases, { oidc });
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const first = await app.inject({
      method: 'GET',
      url: await authorize(login.headers.location as string),
    });
    const cookie = `pl_session=${first.cookies.find((c) => c.name === 'pl_session')!.value}`;
    const start = await app.inject({
      method: 'GET',
      url: '/api/auth/mot-de-passe',
      headers: { cookie },
    });
    const back = await app.inject({
      method: 'GET',
      url: `${await authorize(start.headers.location as string)}&kc_action_status=cancelled`,
      headers: { cookie },
    });
    expect(back.headers.location).toBe('/mes-donnees?motdepasse=inchange');
  });

  it('ne propose pas Keycloak à un compte sans identité Keycloak', async () => {
    const app = testApp(databases, { oidc, devLogin: true });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { email: 'dev@soredi.example' },
    });
    const cookie = `pl_session=${login.cookies.find((c) => c.name === 'pl_session')!.value}`;
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/mot-de-passe',
      headers: { cookie },
    });
    expect(res.headers.location).toBe('/mes-donnees?motdepasse=indisponible');
  });

  it('propose la déconnexion Keycloak', async () => {
    const url = await oidc.logoutUrl(`${APP_URL}/connexion`);
    expect(url?.searchParams.get('client_id')).toBe('prolearning');
    expect(url?.searchParams.get('post_logout_redirect_uri')).toBe(`${APP_URL}/connexion`);
  });
});
