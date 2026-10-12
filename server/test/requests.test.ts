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

type Json = Record<string, any>;

const inDays = (days: number, hours = 9) => {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  d.setUTCHours(hours, 0, 0, 0);
  return d.toISOString();
};

describe.skipIf(!databasesAvailable)('demandes d’inscription et sur mesure', () => {
  let databases: Databases;
  let app: FastifyInstance;
  let lea: string; // collaboratrice, rattachée à Marc
  let tom: string; // collaborateur, rattaché à Marc
  let solo: string; // collaborateur sans manager
  let marc: string; // manager
  let nina: string; // autre manager
  let equipe: string; // équipe formation
  let sessionId: number;

  beforeAll(() => {
    databases = openTestDatabases();
  });
  afterAll(() => closeTestDatabases(databases));

  const userId = async (email: string) =>
    Number(
      (await databases.production.query('SELECT id FROM pl_users WHERE email = $1', [email]))
        .rows[0].id,
    );

  beforeEach(async () => {
    await resetDatabases(databases);
    app = testApp(databases);
    for (const email of ['marc', 'nina', 'equipe', 'lea', 'tom', 'solo']) {
      await login(app, `${email}@soredi.example`);
    }
    await promote(databases, 'marc@soredi.example', 'manager');
    await promote(databases, 'nina@soredi.example', 'manager');
    await promote(databases, 'equipe@soredi.example', 'training');
    const marcId = await userId('marc@soredi.example');
    await databases.production.query(
      `UPDATE pl_users SET manager_id = $1 WHERE email IN ('lea@soredi.example', 'tom@soredi.example')`,
      [marcId],
    );
    [lea, tom, solo, marc, nina, equipe] = await Promise.all(
      ['lea', 'tom', 'solo', 'marc', 'nina', 'equipe'].map((e) =>
        login(app, `${e}@soredi.example`),
      ),
    );

    await post(
      '/api/catalogue',
      {
        id: 'togaf',
        titre: 'TOGAF',
        theme: 'Architecture',
        resume: 'Résumé.',
        publiee: true,
      },
      equipe,
    );
    sessionId = (
      await post(
        '/api/catalogue/togaf/sessions',
        { modalite: 'site', debut: inDays(10), fin: inDays(10, 17), places: 1 },
        equipe,
      )
    ).json().id;
  });

  const get = (url: string, cookie: string) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const post = (url: string, payload: object, cookie: string) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });

  async function ask(cookie: string, motif = ''): Promise<Json> {
    const res = await post('/api/demandes/inscriptions', { sessionId, motif }, cookie);
    expect(res.statusCode).toBe(201);
    return res.json();
  }
  const managerSays = (id: number, decision: string, cookie = marc, commentaire = '') =>
    post(`/api/demandes/inscriptions/${id}/avis-manager`, { decision, commentaire }, cookie);
  const teamSays = (id: number, decision: string, commentaire = '') =>
    post(`/api/demandes/inscriptions/${id}/decision`, { decision, commentaire }, equipe);
  const seats = async (cookie = lea) =>
    (await get('/api/catalogue/togaf', cookie)).json().sessions[0].placesRestantes;

  it('suit le parcours complet : demande, avis du manager, confirmation, place prise', async () => {
    const demande = await ask(lea, 'Pour le projet Atelia.');
    expect(demande).toMatchObject({ statut: 'attente_manager', motif: 'Pour le projet Atelia.' });
    expect((await get('/api/catalogue/togaf', lea)).json().mesDemandes).toEqual({
      [sessionId]: { id: demande.id, statut: 'attente_manager' },
    });

    // Le manager voit la demande de son équipe ; un autre manager, non.
    const equipeMarc = (await get('/api/demandes/equipe', marc)).json();
    expect(equipeMarc.aValider.map((d: Json) => d.id)).toEqual([demande.id]);
    expect((await get('/api/demandes/equipe', nina)).json().aValider).toEqual([]);
    expect((await managerSays(demande.id, 'accepter', nina)).statusCode).toBe(404);

    const avis = await managerSays(demande.id, 'accepter', marc, 'Accord.');
    expect(avis.json().statut).toBe('attente_formation');
    expect((await managerSays(demande.id, 'accepter')).statusCode).toBe(409);
    expect(await seats()).toBe(1);

    const file = (await get('/api/demandes/a-traiter', equipe)).json();
    expect(file.inscriptions.map((d: Json) => d.id)).toEqual([demande.id]);
    const confirm = await teamSays(demande.id, 'accepter', 'Bienvenue.');
    expect(confirm.json().statut).toBe('confirmee');
    expect(await seats()).toBe(0);

    const mine = (await get('/api/demandes', lea)).json().inscriptions[0];
    expect(mine.historique.map((e: Json) => [e.statut, e.par, e.commentaire])).toEqual([
      ['attente_manager', 'lea', 'Pour le projet Atelia.'],
      ['attente_formation', 'marc', 'Accord.'],
      ['confirmee', 'equipe', 'Bienvenue.'],
    ]);

    // Désinscription : la place se libère.
    const cancel = await post(`/api/demandes/inscriptions/${demande.id}/annulation`, {}, lea);
    expect(cancel.json().statut).toBe('annulee');
    expect(await seats()).toBe(1);
  });

  it('ne confirme pas au-delà des places, et refuse une demande sur session complète', async () => {
    const a = await ask(lea);
    const b = await ask(tom);
    await managerSays(a.id, 'accepter');
    await managerSays(b.id, 'accepter');
    expect((await teamSays(a.id, 'accepter')).statusCode).toBe(200);
    const full = await teamSays(b.id, 'accepter');
    expect(full.statusCode).toBe(409);
    expect(full.json().message).toBe('Cette session est complète.');
    // Refuser reste possible.
    expect((await teamSays(b.id, 'refuser', 'Session complète.')).json().statut).toBe('refusee');
    // Plus de place : nouvelle demande refusée d'emblée.
    expect(
      (await post('/api/demandes/inscriptions', { sessionId }, solo)).json().message,
    ).toContain('manager');
    const nouveau = await post('/api/demandes/inscriptions', { sessionId }, tom);
    expect(nouveau.statusCode).toBe(409);
    expect(nouveau.json().message).toBe('Cette session est complète.');
  });

  it('exige un manager, refuse les doublons et les sessions closes', async () => {
    const sansManager = await post('/api/demandes/inscriptions', { sessionId }, solo);
    expect(sansManager.statusCode).toBe(409);
    expect(sansManager.json().message).toContain('Aucun manager');

    await ask(lea);
    const doublon = await post('/api/demandes/inscriptions', { sessionId }, lea);
    expect(doublon.json().message).toBe('Vous avez déjà une demande pour cette session.');

    const passee = (
      await post(
        '/api/catalogue/togaf/sessions',
        { modalite: 'site', debut: inDays(-2), fin: inDays(-2, 17), places: 5 },
        equipe,
      )
    ).json();
    const late = await post('/api/demandes/inscriptions', { sessionId: passee.id }, tom);
    expect(late.json().message).toBe('Cette session a déjà commencé.');
    const unknown = await post('/api/demandes/inscriptions', { sessionId: 9999 }, tom);
    expect(unknown.statusCode).toBe(404);
  });

  it('le refus du manager clôt la demande ; une nouvelle demande reste possible', async () => {
    const demande = await ask(lea);
    const refus = await managerSays(demande.id, 'refuser', marc, 'Pas ce trimestre.');
    expect(refus.json().statut).toBe('refusee');
    expect((await teamSays(demande.id, 'accepter')).statusCode).toBe(409);
    expect((await get('/api/demandes/equipe', marc)).json().recentes[0].id).toBe(demande.id);
    await ask(lea);
  });

  it('l’annulation d’une session clôt ses demandes et libère les places', async () => {
    const a = await ask(lea);
    const b = await ask(tom);
    await managerSays(a.id, 'accepter');
    await teamSays(a.id, 'accepter');
    await post(`/api/sessions/${sessionId}/annulation`, {}, equipe);
    const mine = (await get('/api/demandes', lea)).json().inscriptions[0];
    expect(mine.statut).toBe('annulee');
    expect(mine.historique.at(-1).commentaire).toBe('Session annulée par l’équipe formation.');
    expect((await get('/api/demandes', tom)).json().inscriptions[0].statut).toBe('annulee');
    const left = await databases.production.query(
      `SELECT count(*)::int AS n FROM pl_session_registrations WHERE statut = 'confirmee'`,
    );
    expect(left.rows[0].n).toBe(0);
    expect(b.id).toBeGreaterThan(a.id);
  });

  it('garde chaque demande pour son auteur', async () => {
    const demande = await ask(lea);
    expect(
      (await post(`/api/demandes/inscriptions/${demande.id}/annulation`, {}, tom)).statusCode,
    ).toBe(404);
    expect((await get('/api/demandes', tom)).json().inscriptions).toEqual([]);
    expect((await get('/api/demandes/equipe', lea)).statusCode).toBe(403);
    expect((await get('/api/demandes/a-traiter', marc)).statusCode).toBe(403);
    expect((await teamSays(demande.id, 'accepter')).statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: '/api/demandes' })).statusCode).toBe(401);
  });

  it('traite une demande de session sur mesure', async () => {
    expect(
      (
        await post(
          '/api/demandes/sur-mesure',
          { sujet: 'x', modalite: 'site', participants: 3 },
          lea,
        )
      ).statusCode,
    ).toBe(403);
    const res = await post(
      '/api/demandes/sur-mesure',
      {
        courseId: 'togaf',
        sujet: 'TOGAF pour l’équipe Atelia',
        modalite: 'site',
        participants: 6,
        periode: 'Novembre',
        details: 'Dans nos locaux de Lyon.',
      },
      marc,
    );
    expect(res.statusCode).toBe(201);
    const demande = res.json();
    expect(demande).toMatchObject({ statut: 'a_traiter', courseTitre: 'TOGAF', participants: 6 });

    const file = (await get('/api/demandes/a-traiter', equipe)).json();
    expect(file.surMesure.map((d: Json) => d.id)).toEqual([demande.id]);
    const traiter = (statut: string, commentaire = '') =>
      post(`/api/demandes/sur-mesure/${demande.id}/traitement`, { statut, commentaire }, equipe);
    expect((await traiter('en_cours', 'On cherche un formateur.')).json().statut).toBe('en_cours');
    expect((await traiter('acceptee', 'Session le 20 novembre.')).json().statut).toBe('acceptee');
    expect((await traiter('refusee')).statusCode).toBe(409);
    expect(
      (await post(`/api/demandes/sur-mesure/${demande.id}/annulation`, {}, marc)).statusCode,
    ).toBe(409);

    const mine = (await get('/api/demandes', marc)).json().surMesure[0];
    expect(mine.historique.map((e: Json) => e.statut)).toEqual([
      'a_traiter',
      'en_cours',
      'acceptee',
    ]);
    expect(mine.historique.at(-1).commentaire).toBe('Session le 20 novembre.');

    const unknownCourse = await post(
      '/api/demandes/sur-mesure',
      { courseId: 'inconnue', sujet: 'x', modalite: 'site', participants: 3 },
      marc,
    );
    expect(unknownCourse.statusCode).toBe(409);
  });

  it('tient les demandes de chaque espace dans sa base', async () => {
    await ask(lea);
    const admin = await login(app, BOOTSTRAP_ADMIN);
    await post('/api/space', { space: 'demo' }, admin);
    expect((await get('/api/demandes', admin)).json()).toEqual({ inscriptions: [], surMesure: [] });
    const demo = await databases.demo.query('SELECT 1 FROM pl_registration_requests');
    expect(demo.rowCount).toBe(0);
  });
});
