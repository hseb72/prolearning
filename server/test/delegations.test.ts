import type { FastifyInstance } from 'fastify';
import type { Databases } from '../src/databases.js';
import { DELETED_ACTOR } from '../src/privacy.js';
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

/** Date de Paris, à `offset` jours d'aujourd'hui (AAAA-MM-JJ). */
const day = (offset: number) =>
  new Date(Date.now() + offset * 24 * 3600 * 1000).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Paris',
  });

const inDays = (days: number, hours = 9) => {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  d.setUTCHours(hours, 0, 0, 0);
  return d.toISOString();
};

describe.skipIf(!databasesAvailable)('suppléance d’un manager', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let admin: string;
  let marc: string; // manager de Léa et de Tom
  let lea: string;
  let tom: string; // dans l'équipe de Marc, désigné suppléant
  let solo: string; // hors de l'équipe
  let equipe: string;
  let sessionId: number;
  const ids: Record<string, number> = {};

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));

  const get = (url: string, cookie: string) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const send = (method: 'POST' | 'PUT' | 'DELETE', url: string, cookie: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });

  beforeEach(async () => {
    await resetDatabases(databases);
    app = testApp(databases);
    admin = await login(app, BOOTSTRAP_ADMIN);
    for (const name of ['marc', 'lea', 'tom', 'solo', 'equipe']) {
      await login(app, `${name}@soredi.example`);
    }
    await promote(databases, 'marc@soredi.example', 'manager');
    await promote(databases, 'equipe@soredi.example', 'training');
    const rows = await databases.production.query<{ id: number; email: string }>(
      'SELECT id::int, email FROM pl_users',
    );
    for (const r of rows.rows) ids[r.email.split('@')[0]!] = r.id;
    await databases.production.query(
      `UPDATE pl_users SET manager_id = $1 WHERE email IN ('lea@soredi.example', 'tom@soredi.example')`,
      [ids['marc']],
    );
    [marc, lea, tom, solo, equipe] = await Promise.all(
      ['marc', 'lea', 'tom', 'solo', 'equipe'].map((e) => login(app, `${e}@soredi.example`)),
    );
    await send('POST', '/api/catalogue', equipe, {
      id: 'togaf',
      titre: 'TOGAF',
      theme: 'Architecture',
      resume: 'Résumé.',
      publiee: true,
    });
    sessionId = (
      await send('POST', '/api/catalogue/togaf/sessions', equipe, {
        modalite: 'site',
        debut: inDays(10),
        fin: inDays(10, 17),
        places: 5,
      })
    ).json().id;
  });

  const ask = async (cookie: string): Promise<Json> =>
    (await send('POST', '/api/demandes/inscriptions', cookie, { sessionId })).json();
  const decide = (id: number, cookie: string, decision = 'accepter') =>
    send('POST', `/api/demandes/inscriptions/${id}/avis-manager`, cookie, {
      decision,
      commentaire: '',
    });
  const delegate = (suppleant: number, debut = day(0), fin = day(7), cookie = marc) =>
    send('PUT', '/api/suppleance', cookie, { suppleantId: suppleant, debut, fin });

  it('le suppléant valide pour le manager, qui garde la main ; l’historique le dit', async () => {
    const demandeLea = await ask(lea);
    const demandeTom = await ask(tom);
    const set = await delegate(ids['tom']!);
    expect(set.statusCode).toBe(200);
    expect(set.json()).toMatchObject({
      manager: { displayName: 'marc' },
      suppleant: { displayName: 'tom' },
      etat: 'en_cours',
    });

    // Tom, simple collaborateur, voit « Mon équipe » et la demande de Léa, pas la sienne.
    expect((await get('/api/auth/me', tom)).json().suppleant).toBe(true);
    const team = (await get('/api/demandes/equipe', tom)).json();
    expect(team.aValider).toEqual([]);
    expect(team.suppleances).toHaveLength(1);
    expect(team.suppleances[0].manager.displayName).toBe('marc');
    expect(team.suppleances[0].aValider.map((d: Json) => d.id)).toEqual([demandeLea.id]);

    // Il ne valide pas sa propre demande.
    expect((await decide(demandeTom.id, tom)).statusCode).toBe(404);
    const done = await decide(demandeLea.id, tom);
    expect(done.statusCode).toBe(200);
    expect(done.json().statut).toBe('attente_formation');
    expect(done.json().historique.at(-1)).toMatchObject({ par: 'tom', pour: 'marc' });

    // Le manager garde la main pendant la suppléance.
    const byMarc = await decide(demandeTom.id, marc, 'refuser');
    expect(byMarc.json().statut).toBe('refusee');
    expect(byMarc.json().historique.at(-1).pour).toBeUndefined();

    const log = await databases.production.query(
      "SELECT action, details FROM pl_audit_log WHERE action LIKE 'delegation.%'",
    );
    expect(log.rows).toEqual([
      {
        action: 'delegation.set',
        details: { managerId: ids['marc'], delegateId: ids['tom'], debut: day(0), fin: day(7) },
      },
    ]);
  });

  it('n’ouvre rien avant le début ni après la fin de la suppléance', async () => {
    const demande = await ask(lea);
    await delegate(ids['solo']!, day(3), day(10));
    const mine = (await get('/api/suppleance', solo)).json();
    expect(mine.jeSupplee).toMatchObject([{ etat: 'a_venir', debut: day(3) }]);
    expect((await get('/api/auth/me', solo)).json().suppleant).toBe(false);
    expect((await get('/api/demandes/equipe', solo)).statusCode).toBe(403);
    expect((await decide(demande.id, solo)).statusCode).toBe(404);

    // Fin anticipée par le manager.
    await delegate(ids['solo']!);
    expect((await get('/api/auth/me', solo)).json().suppleant).toBe(true);
    expect((await send('DELETE', '/api/suppleance', marc)).statusCode).toBe(204);
    expect((await get('/api/suppleance', marc)).json().maSuppleance).toBeNull();
    expect((await decide(demande.id, solo)).statusCode).toBe(404);
  });

  it('refuse une suppléance mal formée', async () => {
    expect((await delegate(ids['marc']!)).statusCode).toBe(409);
    expect((await delegate(ids['solo']!, day(5), day(2))).json().message).toContain('précède');
    expect((await delegate(ids['solo']!, day(-10), day(-2))).json().message).toContain('terminée');
    expect((await delegate(ids['solo']!, day(0), day(400))).json().message).toContain('366');
    expect((await delegate(ids['solo']!, '2026-02-30', day(2))).statusCode).toBe(409);
    expect((await delegate(999_999)).json().message).toContain('actif');
    // Un collaborateur n'a pas d'équipe à confier.
    expect((await delegate(ids['marc']!, day(0), day(2), lea)).statusCode).toBe(403);
  });

  it('un administrateur règle la suppléance d’un manager absent', async () => {
    const url = `/api/users/${ids['marc']}/suppleance`;
    const set = await send('PUT', url, admin, {
      suppleantId: ids['solo'],
      debut: day(0),
      fin: day(5),
    });
    expect(set.statusCode).toBe(200);
    const read = (await get(url, admin)).json();
    expect(read.suppleance.suppleant.displayName).toBe('solo');
    expect(read.candidats.map((c: Json) => c.displayName)).not.toContain('marc');
    expect((await get(url, marc)).statusCode).toBe(403);
    // Pas de suppléance pour qui n'est pas manager.
    const notManager = await send('PUT', `/api/users/${ids['lea']}/suppleance`, admin, {
      suppleantId: ids['solo'],
      debut: day(0),
      fin: day(5),
    });
    expect(notManager.statusCode).toBe(409);
    expect((await send('DELETE', url, admin)).statusCode).toBe(204);
  });

  it('efface le nom du manager supprimé de l’historique des validations en suppléance', async () => {
    const demande = await ask(lea);
    await delegate(ids['tom']!);
    await decide(demande.id, tom);
    expect((await send('DELETE', `/api/users/${ids['marc']}`, admin)).statusCode).toBe(204);
    const events = await databases.production.query(
      `SELECT for_name, for_id FROM pl_request_events WHERE actor_name = 'tom'`,
    );
    expect(events.rows).toEqual([{ for_name: DELETED_ACTOR, for_id: null }]);
    expect(
      (await databases.production.query('SELECT count(*)::int AS n FROM pl_delegations')).rows[0].n,
    ).toBe(0);
  });
});
