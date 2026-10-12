import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { compareSemver, decide } from '../src/format/store.js';
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

describe.skipIf(!databasesAvailable)('import, export et publication des formations', () => {
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

  it('n’importe qu’en démonstration', async () => {
    const res = await upload(original);
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/espace démonstration/);
  });

  it('importe la formation exemple et la réexporte octet pour octet', async () => {
    await toDemo();
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
    await toDemo();
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

    const log = await databases.demo.query(
      "SELECT actor_label, details FROM pl_audit_log WHERE action = 'formation.import' ORDER BY id",
    );
    expect(log.rows.map((r) => r.details.action)).toEqual([
      'nouvelle',
      'remplacement',
      'nouvelle-version',
    ]);
    expect(log.rows[0].actor_label).toBe(`${BOOTSTRAP_ADMIN} (en tant que Alice Martin)`);
  });

  it('refuse un fichier invalide avec son rapport', async () => {
    await toDemo();
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

  it('publie en production depuis la démonstration, sans perte et une seule fois', async () => {
    await toDemo();
    await upload(original);
    // Avant publication, la production ne voit rien.
    await toProduction();
    expect((await list()).json()).toEqual([]);
    expect((await publish('0.1.0')).statusCode).toBe(409); // pas depuis la production

    await toDemo();
    const published = await publish('0.1.0');
    expect(published.statusCode).toBe(201);
    expect(published.json()).toEqual({ publiee: true, action: 'nouvelle' });
    expect((await list()).json()[0].versions[0].publishedAt).not.toBeNull();
    const again = await publish('0.1.0');
    expect(again.statusCode).toBe(409);
    expect(again.json().refus).toMatch(/existe déjà/);

    await toProduction();
    const production = (await list()).json();
    expect(production).toMatchObject([{ id: 'togaf10', versionCourante: '0.1.0' }]);
    expect(production[0].versions[0]).toMatchObject({
      origine: 'publication',
      importedBy: BOOTSTRAP_ADMIN,
    });
    expect((await exportVersion('0.1.0')).rawPayload.equals(original)).toBe(true);

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
    await toDemo();
    await upload(original);
    const personas = (
      await app.inject({ method: 'GET', url: '/api/space/personas', headers: { cookie: admin } })
    ).json() as { id: number; role: string }[];
    await toDemo(personas.find((p) => p.role === 'training')!.id);
    expect((await publish('0.1.0')).statusCode).toBe(403);
    expect((await databases.production.query('SELECT 1 FROM pl_formations')).rowCount).toBe(0);
  });
});
