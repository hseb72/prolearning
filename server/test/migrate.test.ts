import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { migrate, migrateAll, migrationsDir } from '../src/migrate.js';

// Tests d'intégration sur deux vraies bases PostgreSQL, comme en production.
// En CI, leur absence est une erreur ; en local, ils sont sautés avec un avertissement.
const urls = {
  production: process.env['TEST_DATABASE_URL_PRODUCTION'],
  demo: process.env['TEST_DATABASE_URL_DEMO'],
};
const available = Boolean(urls.production && urls.demo);
if (!available && process.env['CI']) {
  throw new Error('TEST_DATABASE_URL_PRODUCTION et TEST_DATABASE_URL_DEMO sont requis en CI.');
}
if (!available) console.warn('Tests de migration sautés : bases de test non configurées.');

describe.skipIf(!available)('migrations', () => {
  let production: pg.Pool;
  let demo: pg.Pool;
  let dir: string;

  async function reset(pool: pg.Pool): Promise<void> {
    await pool.query('DROP TABLE IF EXISTS pl_migrations, pl_test_items, pl_test_broken');
  }

  async function tables(pool: pg.Pool): Promise<string[]> {
    const res = await pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'pl_test%' ORDER BY 1",
    );
    return res.rows.map((row) => row.tablename);
  }

  beforeAll(() => {
    production = new pg.Pool({ connectionString: urls.production });
    demo = new pg.Pool({ connectionString: urls.demo });
  });

  afterAll(async () => {
    await Promise.all([reset(production), reset(demo)]);
    await Promise.all([production.end(), demo.end()]);
  });

  beforeEach(async () => {
    await Promise.all([reset(production), reset(demo)]);
    dir = mkdtempSync(join(tmpdir(), 'pl-migrations-'));
    writeFileSync(
      join(dir, '001_items.sql'),
      'CREATE TABLE pl_test_items (id serial PRIMARY KEY);',
    );
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('trouve le dossier db/migrations du dépôt', () => {
    expect(migrationsDir()).toMatch(/db[\\/]migrations$/);
  });

  it('applique chaque script une seule fois', async () => {
    expect(await migrate(production, dir)).toEqual(['001_items.sql']);
    expect(await migrate(production, dir)).toEqual([]);
    expect(await tables(production)).toEqual(['pl_test_items']);
  });

  it('donne le même schéma aux deux bases', async () => {
    const applied = await migrateAll({ production, demo }, dir);
    expect(applied).toEqual({ production: ['001_items.sql'], demo: ['001_items.sql'] });
    expect(await tables(production)).toEqual(['pl_test_items']);
    expect(await tables(demo)).toEqual(['pl_test_items']);
  });

  it('n’applique qu’une fois quand deux répliques démarrent ensemble', async () => {
    const [first, second] = await Promise.all([migrate(production, dir), migrate(production, dir)]);
    expect([...first, ...second]).toEqual(['001_items.sql']);
  });

  it('annule un script en échec sans l’enregistrer', async () => {
    writeFileSync(
      join(dir, '002_broken.sql'),
      'CREATE TABLE pl_test_broken (id int); SELECT * FROM table_inexistante;',
    );
    await expect(migrate(production, dir)).rejects.toThrow(/002_broken\.sql en échec/);
    expect(await tables(production)).toEqual(['pl_test_items']);
    const recorded = await production.query('SELECT name FROM pl_migrations ORDER BY name');
    expect(recorded.rows).toEqual([{ name: '001_items.sql' }]);
  });
});
