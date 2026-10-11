import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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

/**
 * Isolation des espaces production / démonstration (cf. CLAUDE.md) : ce qui se fait dans
 * un espace ne se voit ni ne s'écrit dans l'autre, et seul un administrateur change d'espace.
 */
describe.skipIf(!databasesAvailable)('isolation des espaces', () => {
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

  const get = (url: string, cookie: string) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const post = (url: string, cookie: string, payload: object) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const patch = (url: string, cookie: string, payload: object) =>
    app.inject({ method: 'PATCH', url, headers: { cookie }, payload });

  it('sert un non-administrateur par la production, sans bascule possible', async () => {
    const lea = await login(app, 'lea@soredi.example');
    expect((await post('/api/space', lea, { space: 'demo' })).statusCode).toBe(403);
    expect((await get('/api/space/personas', lea)).statusCode).toBe(403);
    expect((await get('/api/auth/me', lea)).json().space).toBe('production');
  });

  it('ignore un espace « démo » inscrit dans la session d’un non-administrateur', async () => {
    const lea = await login(app, 'lea@soredi.example');
    await databases.production.query(
      "UPDATE pl_sessions SET active_space = 'demo' WHERE user_id = (SELECT id FROM pl_users WHERE email = 'lea@soredi.example')",
    );
    expect((await get('/api/auth/me', lea)).json().space).toBe('production');
  });

  it('fait jouer à l’administrateur un compte fictif, avec les données de la démo seulement', async () => {
    const switched = await post('/api/space', admin, { space: 'demo' });
    expect(switched.statusCode).toBe(200);
    expect(switched.json()).toMatchObject({
      space: 'demo',
      user: { email: BOOTSTRAP_ADMIN, role: 'admin' },
      actor: { displayName: 'Alice Martin', role: 'admin' },
    });
    const users = (await get('/api/users', admin)).json() as { email: string }[];
    expect(users.map((u) => u.email)).toEqual([
      'alice.martin@demo.invalid',
      'bruno.lefevre@demo.invalid',
      'chloe.bernard@demo.invalid',
      'david.moreau@demo.invalid',
      'emma.petit@demo.invalid',
    ]);
    expect(users.map((u) => u.email)).not.toContain(BOOTSTRAP_ADMIN);

    await post('/api/space', admin, { space: 'production' });
    const production = (await get('/api/users', admin)).json() as { email: string }[];
    expect(production.map((u) => u.email)).toEqual([BOOTSTRAP_ADMIN]);
  });

  it('applique les droits du rôle joué, sans retirer le droit de revenir', async () => {
    const personas = (await get('/api/space/personas', admin)).json() as {
      id: number;
      role: string;
    }[];
    const employee = personas.find((p) => p.role === 'employee')!;
    const switched = await post('/api/space', admin, { space: 'demo', personaId: employee.id });
    expect(switched.json().actor.role).toBe('employee');
    expect((await get('/api/users', admin)).statusCode).toBe(403);
    const back = await post('/api/space', admin, { space: 'production' });
    expect(back.statusCode).toBe(200);
    expect(back.json().space).toBe('production');
  });

  it('écrit dans la base de l’espace actif, et seulement elle', async () => {
    await post('/api/space', admin, { space: 'demo' });
    const users = (await get('/api/users', admin)).json() as { id: number; email: string }[];
    const david = users.find((u) => u.email === 'david.moreau@demo.invalid')!;
    expect((await patch(`/api/users/${david.id}`, admin, { role: 'manager' })).statusCode).toBe(
      200,
    );

    const demoRole = await databases.demo.query('SELECT role FROM pl_users WHERE id = $1', [
      david.id,
    ]);
    expect(demoRole.rows[0].role).toBe('manager');
    // En production, le compte de même identifiant (s'il existe) n'a pas bougé.
    const prodChanges = await databases.production.query(
      "SELECT 1 FROM pl_audit_log WHERE action = 'user.role'",
    );
    expect(prodChanges.rowCount).toBe(0);
    const demoChanges = await databases.demo.query(
      "SELECT actor_label FROM pl_audit_log WHERE action = 'user.role'",
    );
    expect(demoChanges.rows).toEqual([{ actor_label: 'alice.martin@demo.invalid' }]);
    // La bascule, elle, est journalisée en production, au nom de la vraie personne.
    const switches = await databases.production.query(
      "SELECT actor_label FROM pl_audit_log WHERE action = 'space.switch'",
    );
    expect(switches.rows).toEqual([{ actor_label: BOOTSTRAP_ADMIN }]);
  });

  it('ramène en production un administrateur qui perd son rôle', async () => {
    await post('/api/space', admin, { space: 'demo' });
    await promote(databases, BOOTSTRAP_ADMIN, 'training');
    expect((await get('/api/auth/me', admin)).json()).toMatchObject({
      space: 'production',
      canSwitchSpace: false,
    });
  });

  it('refuse de jouer un compte qui n’existe pas en démo', async () => {
    const res = await post('/api/space', admin, { space: 'demo', personaId: 999_999 });
    expect(res.statusCode).toBe(409);
  });

  it('donne exactement le même schéma aux deux bases', async () => {
    const columns = `SELECT table_name, column_name, data_type FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name LIKE 'pl\\_%' ORDER BY 1, 2`;
    const [prod, demo] = await Promise.all([
      databases.production.query(columns),
      databases.demo.query(columns),
    ]);
    expect(demo.rows).toEqual(prod.rows);
    expect(prod.rowCount).toBeGreaterThan(0);
  });
});

/**
 * Garde-fou statique : seuls les modules d'infrastructure manipulent les deux bases. Le
 * code métier reçoit `request.auth.db`, la base de l'espace actif, et rien d'autre.
 */
describe('accès aux bases', () => {
  const ALLOWED = new Set([
    'app.ts',
    'context.ts',
    'databases.ts',
    'main.ts',
    'migrate.ts',
    'migrate-cli.ts',
    'space-routes.ts',
    'auth/routes.ts',
  ]);

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
    });
  }

  it('n’est possible qu’aux modules autorisés', () => {
    const root = join(import.meta.dirname, '..', 'src');
    const offenders = sources(root)
      .map((path) => relative(root, path).replaceAll('\\', '/'))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) =>
        /databases\.js'|\bDatabases\b/.test(readFileSync(join(root, file), 'utf8')),
      );
    expect(offenders).toEqual([]);
  });
});
