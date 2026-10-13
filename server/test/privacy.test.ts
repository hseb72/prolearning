import type { FastifyInstance } from 'fastify';
import type { Databases } from '../src/databases.js';
import { DELETED_ACTOR, purgeExpiredData } from '../src/privacy.js';
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

const inDays = (days: number, hours = 9) => {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  d.setUTCHours(hours, 0, 0, 0);
  return d.toISOString();
};

describe.skipIf(!databasesAvailable)('données personnelles', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let admin: string;
  let lea: string; // collaboratrice, rattachée à Marc
  let marc: string; // manager
  let equipe: string; // équipe formation
  let leaId: number;
  let marcId: number;
  let sessionId: number;

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));

  const db = () => databases.production;
  const userId = async (email: string) =>
    Number((await db().query('SELECT id FROM pl_users WHERE email = $1', [email])).rows[0].id);
  const call = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    cookie: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });

  beforeEach(async () => {
    await resetDatabases(databases);
    app = testApp(databases);
    admin = await login(app, BOOTSTRAP_ADMIN);
    for (const name of ['marc', 'equipe', 'lea']) await login(app, `${name}@soredi.example`);
    await promote(databases, 'marc@soredi.example', 'manager');
    await promote(databases, 'equipe@soredi.example', 'training');
    [leaId, marcId] = [await userId('lea@soredi.example'), await userId('marc@soredi.example')];
    await db().query('UPDATE pl_users SET manager_id = $1 WHERE id = $2', [marcId, leaId]);
    [lea, marc, equipe] = await Promise.all(
      ['lea', 'marc', 'equipe'].map((n) => login(app, `${n}@soredi.example`)),
    );
    await call('POST', '/api/catalogue', equipe, {
      id: 'togaf',
      titre: 'TOGAF',
      theme: 'Architecture',
      resume: 'Résumé.',
      publiee: true,
    });
    sessionId = (
      await call('POST', '/api/catalogue/togaf/sessions', equipe, {
        modalite: 'site',
        debut: inDays(10),
        fin: inDays(10, 17),
        places: 4,
      })
    ).json().id;
  });

  /** Léa demande une place, Marc valide, l'équipe formation confirme. */
  async function confirmedRegistration(): Promise<number> {
    const id = (
      await call('POST', '/api/demandes/inscriptions', lea, { sessionId, motif: 'Projet Atelia.' })
    ).json().id;
    await call('POST', `/api/demandes/inscriptions/${id}/avis-manager`, marc, {
      decision: 'accepter',
      commentaire: 'Accord.',
    });
    await call('POST', `/api/demandes/inscriptions/${id}/decision`, equipe, {
      decision: 'accepter',
      commentaire: '',
    });
    return id;
  }

  it('exporte ses propres données, et celles d’un compte pour un administrateur', async () => {
    await confirmedRegistration();
    const mine = await call('GET', '/api/moi/donnees', lea);
    expect(mine.statusCode).toBe(200);
    expect(mine.headers['content-disposition']).toMatch(/attachment; filename="mes-donnees-/);
    const data = mine.json();
    expect(data.compte).toMatchObject({ email: 'lea@soredi.example', manager: 'marc' });
    expect(data.inscriptions).toHaveLength(1);
    expect(data.inscriptions[0]).toMatchObject({
      formation: 'TOGAF',
      statut: 'confirmee',
      message: 'Projet Atelia.',
    });
    expect(data.inscriptions[0].historique.map((e: Json) => e.par)).toEqual([
      'lea',
      'marc',
      'equipe',
    ]);
    // Marc a agi sur la demande de Léa : son export le dit, sans les données de Léa.
    const marcData = (await call('GET', '/api/moi/donnees', marc)).json();
    expect(marcData.actionsSurLesDemandesDesAutres).toHaveLength(1);

    const asAdmin = await call('GET', `/api/users/${leaId}/donnees`, admin);
    expect(asAdmin.json().compte.email).toBe('lea@soredi.example');
    expect((await call('GET', `/api/users/${leaId}/donnees`, marc)).statusCode).toBe(403);
    expect((await call('GET', '/api/users/99999/donnees', admin)).statusCode).toBe(404);
  });

  it('supprime un compte et ses données, libère sa place et efface son nom des historiques', async () => {
    await confirmedRegistration();
    const places = async () =>
      (await call('GET', '/api/catalogue/togaf', equipe)).json().sessions[0].placesRestantes;
    expect(await places()).toBe(3);

    // Marc a validé la demande de Léa ; supprimons d'abord Léa.
    expect((await call('DELETE', `/api/users/${leaId}`, admin)).statusCode).toBe(204);
    expect(await places()).toBe(4);
    for (const table of [
      'pl_registration_requests',
      'pl_session_registrations',
      'pl_request_events',
      'pl_sessions',
    ]) {
      const rows = await db().query(
        `SELECT count(*)::int AS n FROM ${table} WHERE ${
          table === 'pl_request_events' ? 'true' : 'user_id = $1'
        }`,
        table === 'pl_request_events' ? [] : [leaId],
      );
      expect(rows.rows[0].n, table).toBe(0);
    }
    const log = await db().query("SELECT details FROM pl_audit_log WHERE action = 'user.delete'");
    expect(log.rows).toEqual([{ details: { userId: leaId } }]);
    // La session de connexion de Léa ne vaut plus rien.
    expect((await call('GET', '/api/demandes', lea)).statusCode).toBe(401);
  });

  it('remplace le nom d’une personne supprimée dans l’historique des demandes des autres', async () => {
    const id = await confirmedRegistration();
    expect((await call('DELETE', `/api/users/${marcId}`, admin)).statusCode).toBe(204);
    const events = await db().query(
      "SELECT actor_name, actor_id FROM pl_request_events WHERE kind = 'inscription' AND request_id = $1 ORDER BY id",
      [id],
    );
    expect(events.rows.map((e) => e.actor_name)).toEqual(['lea', DELETED_ACTOR, 'equipe']);
    expect(events.rows[1].actor_id).toBeNull();
  });

  it('refuse de supprimer son propre compte, et réserve la suppression aux administrateurs', async () => {
    const adminId = await userId(BOOTSTRAP_ADMIN);
    expect((await call('DELETE', `/api/users/${adminId}`, admin)).statusCode).toBe(409);
    expect((await call('DELETE', `/api/users/${leaId}`, marc)).statusCode).toBe(403);
    expect((await call('DELETE', '/api/users/99999', admin)).statusCode).toBe(404);
  });

  it('règle les durées de conservation dans les bornes, en le journalisant', async () => {
    const url = '/api/parametres/conservation';
    expect((await call('GET', url, admin)).json()).toEqual({
      requestsMonths: 36,
      auditMonths: 12,
      inactiveMonths: 12,
    });
    const next = { requestsMonths: 24, auditMonths: 6, inactiveMonths: 18 };
    expect((await call('PUT', url, admin, next)).json()).toEqual(next);
    expect((await call('GET', url, admin)).json()).toEqual(next);
    expect((await call('PUT', url, admin, { ...next, auditMonths: 0 })).statusCode).toBe(400);
    expect((await call('PUT', url, lea, next)).statusCode).toBe(403);
    expect((await call('GET', url, lea)).json()).toEqual(next);
    const log = await db().query(
      "SELECT details FROM pl_audit_log WHERE action = 'settings.retention'",
    );
    expect(log.rows[0].details.to).toEqual(next);
  });

  it('purge les demandes clôturées et le journal au-delà des durées réglées', async () => {
    const confirmed = await confirmedRegistration();
    // Une demande refusée il y a 40 mois, une sur mesure annulée il y a 37 mois, une ligne
    // du journal de 13 mois : toutes au-delà des durées par défaut (36 et 12 mois).
    await db().query(
      `INSERT INTO pl_registration_requests (session_id, user_id, statut, updated_at)
       VALUES ($1, $2, 'refusee', now() - interval '40 months')`,
      [sessionId, marcId],
    );
    const custom = (
      await call('POST', '/api/demandes/sur-mesure', marc, {
        sujet: 'Atelier',
        modalite: 'site',
        participants: 6,
        periode: 'Novembre',
        details: '',
      })
    ).json().id;
    await db().query(
      "UPDATE pl_custom_requests SET statut = 'annulee', updated_at = now() - interval '37 months' WHERE id = $1",
      [custom],
    );
    await db().query(
      "INSERT INTO pl_audit_log (action, occurred_at) VALUES ('course.update', now() - interval '13 months')",
    );
    const count = async (sql: string, params: unknown[] = []) =>
      (await db().query(sql, params)).rows[0].n as number;

    // La session de l'inscription confirmée est à venir : elle reste, avec sa place.
    expect(await purgeExpiredData(db())).toEqual({ inscriptions: 1, surMesure: 1, journal: 1 });
    expect(
      await count("SELECT count(*)::int AS n FROM pl_request_events WHERE kind = 'sur_mesure'"),
    ).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM pl_session_registrations')).toBe(1);

    // Session terminée depuis plus de 36 mois : l'inscription, son historique et la place partent.
    await db().query(
      "UPDATE pl_course_sessions SET debut = now() - interval '38 months', fin = now() - interval '38 months' + interval '8 hours'",
    );
    expect((await purgeExpiredData(db())).inscriptions).toBe(1);
    expect(await count('SELECT count(*)::int AS n FROM pl_session_registrations')).toBe(0);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM pl_request_events WHERE kind = 'inscription' AND request_id = $1",
        [confirmed],
      ),
    ).toBe(0);
  });

  it('signale les comptes sans connexion depuis plus que la durée réglée', async () => {
    await db().query(
      "UPDATE pl_users SET last_login_at = now() - interval '13 months' WHERE id = $1",
      [leaId],
    );
    const users = (await call('GET', '/api/users', admin)).json() as Json[];
    const dormant = Object.fromEntries(users.map((u) => [u.email, u.dormant]));
    expect(dormant).toMatchObject({ 'lea@soredi.example': true, 'marc@soredi.example': false });
    await call('PUT', '/api/parametres/conservation', admin, {
      requestsMonths: 36,
      auditMonths: 12,
      inactiveMonths: 24,
    });
    const after = (await call('GET', '/api/users', admin)).json() as Json[];
    expect(after.find((u) => u.email === 'lea@soredi.example')!.dormant).toBe(false);
  });
});
