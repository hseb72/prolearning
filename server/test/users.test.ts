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
});
