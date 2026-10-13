import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Databases } from '../src/databases.js';
import { storeFormation } from '../src/format/store.js';
import {
  closeTestDatabases,
  databasesAvailable,
  login,
  openTestDatabases,
  promote,
  resetDatabases,
  testApp,
} from './helpers.js';

type Json = Record<string, any>;

/** La formation exemple réduite à deux modules d'une leçon chacun. */
function formation(): Json {
  const f = JSON.parse(
    readFileSync(
      join(import.meta.dirname, '..', '..', 'fixtures', 'formations', 'togaf10-m1.formation.json'),
      'utf8',
    ),
  );
  const lecon = (id: string) => ({
    id,
    type: 'lecon',
    titre: `Leçon ${id}`,
    blocs: [{ type: 'texte', markdown: 'Texte.' }],
  });
  f.modules = [
    { ...f.modules[0], activites: [lecon('l1')] },
    { ...f.modules[0], id: 'm2', titre: 'Suite', activites: [lecon('l2')] },
  ];
  return f;
}

describe.skipIf(!databasesAvailable)('publication des réussites (décision 5)', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let lea: string; // collaboratrice de Marc
  let tom: string; // collaborateur de Nina
  let marc: string;
  let nina: string;
  let f: Json;

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));

  const db = () => databases.production;
  const id = async (name: string) =>
    Number(
      (await db().query('SELECT id FROM pl_users WHERE email = $1', [`${name}@soredi.example`]))
        .rows[0].id,
    );
  const call = (method: 'GET' | 'PUT', url: string, cookie: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
  const share = (cookie: string, visibilite: string) =>
    call('PUT', `/api/parcours/${f['id']}/partage`, cookie, { visibilite });
  /** Ce que l'API enregistre quand le module 1 est terminé : le résultat et le bonus. */
  const finishModule1 = async (name: string) => {
    const userId = await id(name);
    await db().query(
      `INSERT INTO pl_activity_results (user_id, formation_id, module_id, activite_id, activite_type, status, points, attempts)
       VALUES ($1, $2, $3, 'l1', 'lecon', 'faite', 10, 1)`,
      [userId, f['id'], f['modules'][0].id],
    );
    await db().query(
      'INSERT INTO pl_module_completions (user_id, formation_id, module_id, bonus) VALUES ($1, $2, $3, 50)',
      [userId, f['id'], f['modules'][0].id],
    );
  };

  beforeEach(async () => {
    await resetDatabases(databases);
    app = testApp(databases);
    f = formation();
    await storeFormation(
      db(),
      {
        id: f['id'],
        version: f['version'],
        formatVersion: '1.0',
        titre: f['titre'],
        theme: f['theme'],
        source: JSON.stringify(f),
      },
      { allowReplace: false, origin: 'publication', importedBy: null, importedByLabel: 'test' },
    );
    for (const name of ['marc', 'nina', 'lea', 'tom']) await login(app, `${name}@soredi.example`);
    await promote(databases, 'marc@soredi.example', 'manager');
    await promote(databases, 'nina@soredi.example', 'manager');
    await db().query('UPDATE pl_users SET manager_id = $1 WHERE id = $2', [
      await id('marc'),
      await id('lea'),
    ]);
    await db().query('UPDATE pl_users SET manager_id = $1 WHERE id = $2', [
      await id('nina'),
      await id('tom'),
    ]);
    [marc, nina, lea, tom] = await Promise.all(
      ['marc', 'nina', 'lea', 'tom'].map((n) => login(app, `${n}@soredi.example`)),
    );
  });

  it('reste privé par défaut, et n’est publiable qu’après un module terminé', async () => {
    expect((await call('GET', `/api/parcours/${f['id']}/partage`, lea)).json()).toEqual({
      visibilite: 'prive',
    });
    const early = await share(lea, 'manager');
    expect(early.statusCode).toBe(409);
    expect((await call('GET', '/api/equipe/reussites', marc)).json()).toEqual([]);
    expect((await share(lea, 'nulle-part')).statusCode).toBe(400);
    expect(
      (await call('PUT', '/api/parcours/inconnue/partage', lea, { visibilite: 'manager' }))
        .statusCode,
    ).toBe(404);
  });

  it('montre la réussite au seul manager, puis à tous, puis la retire', async () => {
    await finishModule1('lea');
    expect((await share(lea, 'manager')).json()).toEqual({ visibilite: 'manager' });

    const team = (await call('GET', '/api/equipe/reussites', marc)).json();
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({
      personne: 'lea',
      formationId: f['id'],
      modulesTermines: 1,
      modulesTotal: 2,
      termine: false,
      visibilite: 'manager',
    });
    expect(team[0].badges).toContain('module-termine');
    // Ni l'autre manager, ni la communauté, ni un collaborateur ne la voient.
    expect((await call('GET', '/api/equipe/reussites', nina)).json()).toEqual([]);
    expect((await call('GET', '/api/reussites', tom)).json()).toEqual([]);
    expect((await call('GET', '/api/equipe/reussites', tom)).statusCode).toBe(403);

    await share(lea, 'communaute');
    expect((await call('GET', '/api/reussites', tom)).json().map((a: Json) => a.personne)).toEqual([
      'lea',
    ]);
    // Publiée pour tous, elle reste visible du manager.
    expect((await call('GET', '/api/equipe/reussites', marc)).json()).toHaveLength(1);

    await share(lea, 'prive');
    expect((await call('GET', '/api/reussites', tom)).json()).toEqual([]);
    expect((await call('GET', '/api/equipe/reussites', marc)).json()).toEqual([]);
  });

  it('ne publie que pour soi : le choix porte sur le compte connecté', async () => {
    await finishModule1('lea');
    await finishModule1('tom');
    await share(tom, 'communaute');
    const all = (await call('GET', '/api/reussites', lea)).json();
    expect(all.map((a: Json) => a.personne)).toEqual(['tom']);
  });
});
