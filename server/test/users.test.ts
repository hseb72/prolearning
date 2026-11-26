import type { FastifyInstance } from 'fastify';
import type { Databases } from '../src/databases.js';
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

describe.skipIf(!databasesAvailable)('gestion des rôles', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let admin: string;
  let ids: Record<string, number>;

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));
  beforeEach(async () => {
    await resetDatabases(databases);
    app = testApp(databases);
    admin = await login(app, BOOTSTRAP_ADMIN);
    await login(app, 'marc@soredi.example');
    await login(app, 'lea@soredi.example');
    const rows = await databases.production.query<{ id: number; email: string }>(
      'SELECT id::int, email FROM pl_users',
    );
    ids = Object.fromEntries(rows.rows.map((r) => [r.email, r.id]));
  });

  const patch = (id: number, payload: object, cookie = admin) =>
    app.inject({ method: 'PATCH', url: `/api/users/${id}`, headers: { cookie }, payload });

  it('liste les comptes pour un administrateur seulement', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/users', headers: { cookie: admin } });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(3);
    const lea = await login(app, 'lea@soredi.example');
    const denied = await app.inject({ method: 'GET', url: '/api/users', headers: { cookie: lea } });
    expect(denied.statusCode).toBe(403);
  });

  it('change un rôle et rattache un collaborateur à son manager, en le journalisant', async () => {
    const marc = ids['marc@soredi.example']!;
    const lea = ids['lea@soredi.example']!;
    expect((await patch(marc, { role: 'manager' })).json().role).toBe('manager');
    expect((await patch(lea, { managerId: marc })).json().managerId).toBe(marc);
    const log = await databases.production.query(
      "SELECT action, details FROM pl_audit_log WHERE action LIKE 'user.%' AND action <> 'user.bootstrap_admin' ORDER BY id",
    );
    expect(log.rows).toEqual([
      { action: 'user.role', details: { userId: marc, from: 'employee', to: 'manager' } },
      { action: 'user.manager', details: { userId: lea, from: null, to: marc } },
    ]);
  });

  it('refuse un manager qui n’a pas le rôle de manager', async () => {
    const res = await patch(ids['lea@soredi.example']!, { managerId: ids['marc@soredi.example'] });
    expect(res.statusCode).toBe(409);
  });

  it('refuse qu’un administrateur se retire son propre rôle', async () => {
    const res = await patch(ids[BOOTSTRAP_ADMIN]!, { role: 'employee' });
    expect(res.statusCode).toBe(409);
  });

  it('refuse une modification vide ou un rôle inconnu', async () => {
    expect((await patch(ids['lea@soredi.example']!, {})).statusCode).toBe(400);
    expect((await patch(ids['lea@soredi.example']!, { role: 'superadmin' })).statusCode).toBe(400);
  });

  it('refuse la gestion des rôles à un manager', async () => {
    await promote(databases, 'marc@soredi.example', 'training');
    const marc = await login(app, 'marc@soredi.example');
    const res = await patch(ids['lea@soredi.example']!, { role: 'manager' }, marc);
    expect(res.statusCode).toBe(403);
  });

  it('refuse un rattachement en boucle', async () => {
    const marc = ids['marc@soredi.example']!;
    const lea = ids['lea@soredi.example']!;
    await patch(marc, { role: 'manager' });
    await patch(lea, { role: 'manager' });
    expect((await patch(lea, { managerId: marc })).statusCode).toBe(200);
    const res = await patch(marc, { managerId: lea });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('manager_cycle');
  });
});

describe.skipIf(!databasesAvailable)('import des rattachements', () => {
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
    await login(app, 'marc@soredi.example');
    await login(app, 'lea@soredi.example');
  });

  const send = (contenu: string, appliquer: boolean, cookie = admin) =>
    app.inject({
      method: 'POST',
      url: '/api/users/rattachements',
      headers: { cookie },
      payload: { contenu, appliquer },
    });
  const managers = async () =>
    (
      await databases.production.query<{ email: string; role: string; manager: string | null }>(
        `SELECT u.email, u.role, m.email AS manager FROM pl_users u
           LEFT JOIN pl_users m ON m.id = u.manager_id ORDER BY u.email`,
      )
    ).rows;

  const FILE = [
    'Collaborateur;Nom;Manager',
    'lea@soredi.example;Léa;marc@soredi.example',
    'paul@soredi.example;Paul Martin;marc@soredi.example',
    'marc@soredi.example;;',
  ].join('\r\n');

  it('vérifie sans rien modifier, puis applique : comptes créés, manager promu, journal', async () => {
    const before = await managers();
    const check = await send(FILE, false);
    expect(check.statusCode).toBe(200);
    expect(check.json()).toMatchObject({
      applied: false,
      counts: { created: 1, updated: 1, unchanged: 1, error: 0 },
      promoted: ['marc@soredi.example'],
    });
    expect(check.json().lines[0]).toMatchObject({
      line: 2,
      member: 'lea@soredi.example',
      status: 'updated',
      previousManager: null,
    });
    expect(await managers()).toEqual(before);

    const done = await send(FILE, true);
    expect(done.statusCode).toBe(200);
    expect(done.json().applied).toBe(true);
    expect(await managers()).toEqual([
      { email: BOOTSTRAP_ADMIN, role: 'admin', manager: null },
      { email: 'lea@soredi.example', role: 'employee', manager: 'marc@soredi.example' },
      { email: 'marc@soredi.example', role: 'manager', manager: null },
      { email: 'paul@soredi.example', role: 'employee', manager: 'marc@soredi.example' },
    ]);
    const paul = await databases.production.query(
      "SELECT display_name, oidc_subject FROM pl_users WHERE email = 'paul@soredi.example'",
    );
    expect(paul.rows).toEqual([{ display_name: 'Paul Martin', oidc_subject: null }]);
    const log = await databases.production.query(
      "SELECT details FROM pl_audit_log WHERE action = 'user.import'",
    );
    expect(log.rows).toEqual([{ details: { lignes: 3, crees: 1, modifies: 1, promus: 1 } }]);
    // Réappliquer le même fichier ne change plus rien.
    expect((await send(FILE, false)).json().counts).toEqual({
      created: 0,
      updated: 0,
      unchanged: 3,
      error: 0,
    });
  });

  it('refuse d’appliquer un fichier qui a une erreur, et dit laquelle', async () => {
    const before = await managers();
    const file = [
      'collaborateur,manager',
      'lea@soredi.example,inconnu@soredi.example',
      'pas-une-adresse,marc@soredi.example',
      'marc@soredi.example,lea@soredi.example',
      'lea@soredi.example,marc@soredi.example',
    ].join('\n');
    const res = await send(file, true);
    expect(res.statusCode).toBe(422);
    const lines = res.json().lines as { line: number; status: string; message?: string }[];
    expect(lines.map((l) => [l.line, l.status])).toEqual([
      [2, 'error'],
      [3, 'error'],
      [4, 'updated'],
      [5, 'error'],
    ]);
    expect(lines[0]!.message).toContain('Manager inconnu');
    expect(lines[3]!.message).toContain('ligne 2');
    expect(await managers()).toEqual(before);
  });

  it('refuse une boucle dans le fichier', async () => {
    const file =
      'collaborateur;manager\nlea@soredi.example;marc@soredi.example\nmarc@soredi.example;lea@soredi.example';
    const res = await send(file, false);
    expect(res.json().counts.error).toBe(2);
    expect(res.json().lines[0].message).toContain('boucle');
  });

  it('exige les colonnes collaborateur et manager', async () => {
    const res = await send('adresse;chef\nlea@soredi.example;marc@soredi.example', false);
    expect(res.json().fileError).toContain('« collaborateur » et « manager »');
  });

  it('exporte les rattachements au même format, et réserve tout cela aux administrateurs', async () => {
    await send(FILE, true);
    const csv = await app.inject({
      method: 'GET',
      url: '/api/users/rattachements.csv',
      headers: { cookie: admin },
    });
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body.split('\r\n')).toContain('paul@soredi.example;Paul Martin;marc@soredi.example');
    // Le fichier exporté se réimporte sans changement.
    expect((await send(csv.body, false)).json().counts).toMatchObject({ updated: 0, error: 0 });

    const lea = await login(app, 'lea@soredi.example');
    expect((await send(FILE, false, lea)).statusCode).toBe(403);
    const denied = await app.inject({
      method: 'GET',
      url: '/api/users/rattachements.csv',
      headers: { cookie: lea },
    });
    expect(denied.statusCode).toBe(403);
  });
});
