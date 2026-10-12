import type pg from 'pg';
import type {
  CustomCreate,
  CustomProcessing,
  CustomRequestView,
  CustomStatus,
  RegistrationRequestView,
  RegistrationStatus,
  RequestEvent,
} from '../../../shared/requests.js';
import type { UserRecord } from '../users.js';

/** Refus métier : code HTTP et message affichable. */
export interface Refusal {
  status: 404 | 409;
  message: string;
}
export type Outcome<T> = { ok: T } | { refus: Refusal };

const refuse = (status: 404 | 409, message: string): { refus: Refusal } => ({
  refus: { status, message },
});
const NOT_FOUND = refuse(404, 'Demande introuvable.');

type Db = pg.Pool | pg.PoolClient;

/** Exécute `work` dans une transaction (verrous de session compris). */
async function transaction<T>(
  db: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function addEvent(
  db: Db,
  kind: 'inscription' | 'sur_mesure',
  requestId: number,
  statut: string,
  actor: UserRecord | null,
  commentaire = '',
): Promise<void> {
  await db.query(
    `INSERT INTO pl_request_events (kind, request_id, statut, actor_id, actor_name, commentaire)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [kind, requestId, statut, actor?.id ?? null, actor?.displayName ?? '', commentaire],
  );
}

async function events(
  db: Db,
  kind: 'inscription' | 'sur_mesure',
  ids: number[],
): Promise<Map<number, RequestEvent[]>> {
  const map = new Map<number, RequestEvent[]>();
  if (!ids.length) return map;
  const res = await db.query<{
    request_id: string;
    statut: string;
    actor_name: string;
    commentaire: string;
    created_at: Date;
  }>(
    `SELECT request_id, statut, actor_name, commentaire, created_at FROM pl_request_events
     WHERE kind = $1 AND request_id = ANY($2) ORDER BY id`,
    [kind, ids],
  );
  for (const row of res.rows) {
    const id = Number(row.request_id);
    const list = map.get(id) ?? [];
    list.push({
      date: row.created_at.toISOString(),
      statut: row.statut,
      par: row.actor_name,
      commentaire: row.commentaire,
    });
    map.set(id, list);
  }
  return map;
}

// ── Inscriptions ─────────────────────────────────────────────────────────────

interface RegistrationRow {
  id: string;
  statut: RegistrationStatus;
  motif: string;
  created_at: Date;
  user_id: string;
  display_name: string;
  email: string;
  session_id: string;
  course_id: string;
  course_titre: string;
  modalite: 'distance' | 'site';
  debut: Date;
  fin: Date;
  lieu: string;
  places: number;
  places_prises: string;
  annulee: boolean;
}

const REGISTRATION_SELECT = `SELECT r.id, r.statut, r.motif, r.created_at, r.user_id,
    u.display_name, u.email, s.id AS session_id, s.course_id, c.titre AS course_titre,
    s.modalite, s.debut, s.fin, s.lieu, s.places, s.annulee,
    (SELECT count(*) FROM pl_session_registrations g
      WHERE g.session_id = s.id AND g.statut = 'confirmee') AS places_prises
  FROM pl_registration_requests r
  JOIN pl_users u ON u.id = r.user_id
  JOIN pl_course_sessions s ON s.id = r.session_id
  JOIN pl_courses c ON c.id = s.course_id`;

async function registrations(
  db: Db,
  where: string,
  params: unknown[],
  order = 'r.created_at DESC, r.id DESC',
): Promise<RegistrationRequestView[]> {
  const res = await db.query<RegistrationRow>(
    `${REGISTRATION_SELECT} WHERE ${where} ORDER BY ${order}`,
    params,
  );
  const history = await events(
    db,
    'inscription',
    res.rows.map((r) => Number(r.id)),
  );
  return res.rows.map((row) => ({
    id: Number(row.id),
    statut: row.statut,
    motif: row.motif,
    createdAt: row.created_at.toISOString(),
    demandeur: { id: Number(row.user_id), displayName: row.display_name, email: row.email },
    session: {
      id: Number(row.session_id),
      courseId: row.course_id,
      courseTitre: row.course_titre,
      modalite: row.modalite,
      debut: row.debut.toISOString(),
      fin: row.fin.toISOString(),
      lieu: row.lieu,
      places: row.places,
      placesRestantes: Math.max(0, row.places - Number(row.places_prises)),
      annulee: row.annulee,
    },
    historique: history.get(Number(row.id)) ?? [],
  }));
}

export async function registration(db: Db, id: number): Promise<RegistrationRequestView | null> {
  return (await registrations(db, 'r.id = $1', [id]))[0] ?? null;
}

export const myRegistrations = (db: pg.Pool, userId: number) =>
  registrations(db, 'r.user_id = $1', [userId]);

/** Demandes en cours de l'utilisateur pour ces sessions (affichées sur la fiche). */
export async function activeRequestsBySession(
  db: pg.Pool,
  userId: number,
  sessionIds: number[],
): Promise<Record<number, { id: number; statut: RegistrationStatus }>> {
  if (!sessionIds.length) return {};
  const res = await db.query<{ id: string; session_id: string; statut: RegistrationStatus }>(
    `SELECT id, session_id, statut FROM pl_registration_requests
     WHERE user_id = $1 AND session_id = ANY($2)
       AND statut IN ('attente_manager', 'attente_formation', 'confirmee')`,
    [userId, sessionIds],
  );
  return Object.fromEntries(
    res.rows.map((r) => [Number(r.session_id), { id: Number(r.id), statut: r.statut }]),
  );
}

/** Demandes des collaborateurs rattachés au manager. */
export async function teamRegistrations(db: pg.Pool, managerId: number) {
  const team = 'u.manager_id = $1';
  return {
    aValider: await registrations(
      db,
      `${team} AND r.statut = 'attente_manager'`,
      [managerId],
      's.debut, r.id',
    ),
    recentes: await registrations(
      db,
      `${team} AND r.statut <> 'attente_manager' AND r.updated_at > now() - interval '180 days'`,
      [managerId],
    ),
  };
}

/** Inscriptions validées par le manager, à confirmer par l'équipe formation. */
export const trainingRegistrations = (db: pg.Pool) =>
  registrations(db, `r.statut = 'attente_formation'`, [], 's.debut, r.id');

interface SessionLock {
  places: number;
  annulee: boolean;
  debut: Date;
  publiee: boolean;
  prises: number;
}

/** Verrouille la session (contre la surréservation) et compte ses places prises. */
async function lockSession(client: pg.PoolClient, sessionId: number): Promise<SessionLock | null> {
  const res = await client.query<{
    places: number;
    annulee: boolean;
    debut: Date;
    publiee: boolean;
  }>(
    `SELECT s.places, s.annulee, s.debut, c.publiee FROM pl_course_sessions s
     JOIN pl_courses c ON c.id = s.course_id WHERE s.id = $1 FOR UPDATE OF s`,
    [sessionId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const taken = await client.query<{ n: string }>(
    `SELECT count(*) AS n FROM pl_session_registrations
     WHERE session_id = $1 AND statut = 'confirmee'`,
    [sessionId],
  );
  return { ...row, prises: Number(taken.rows[0]!.n) };
}

function sessionRefusal(session: SessionLock | null): { refus: Refusal } | null {
  if (!session || !session.publiee) return refuse(404, 'Session introuvable.');
  if (session.annulee) return refuse(409, 'Cette session est annulée.');
  if (session.debut <= new Date()) return refuse(409, 'Cette session a déjà commencé.');
  if (session.prises >= session.places) return refuse(409, 'Cette session est complète.');
  return null;
}

/** Le collaborateur demande à s'inscrire ; la demande part à son manager. */
export async function createRegistration(
  db: pg.Pool,
  actor: UserRecord,
  sessionId: number,
  motif: string,
): Promise<Outcome<number>> {
  if (actor.managerId === null) {
    return refuse(
      409,
      'Aucun manager n’est rattaché à votre compte : demandez à un administrateur de le faire, puis renouvelez votre demande.',
    );
  }
  return transaction(db, async (client) => {
    const refusal = sessionRefusal(await lockSession(client, sessionId));
    if (refusal) return refusal;
    const existing = await client.query(
      `SELECT 1 FROM pl_registration_requests WHERE session_id = $1 AND user_id = $2
       AND statut IN ('attente_manager', 'attente_formation', 'confirmee')`,
      [sessionId, actor.id],
    );
    if (existing.rowCount) return refuse(409, 'Vous avez déjà une demande pour cette session.');
    const res = await client.query<{ id: string }>(
      `INSERT INTO pl_registration_requests (session_id, user_id, statut, motif)
       VALUES ($1, $2, 'attente_manager', $3) RETURNING id`,
      [sessionId, actor.id, motif],
    );
    const id = Number(res.rows[0]!.id);
    await addEvent(client, 'inscription', id, 'attente_manager', actor, motif);
    return { ok: id };
  });
}

async function lockRequest(client: pg.PoolClient, id: number) {
  const res = await client.query<{
    statut: RegistrationStatus;
    user_id: string;
    session_id: string;
    manager_id: string | null;
  }>(
    `SELECT r.statut, r.user_id, r.session_id, u.manager_id FROM pl_registration_requests r
     JOIN pl_users u ON u.id = r.user_id WHERE r.id = $1 FOR UPDATE OF r`,
    [id],
  );
  const row = res.rows[0];
  return row
    ? {
        statut: row.statut,
        userId: Number(row.user_id),
        sessionId: Number(row.session_id),
        managerId: row.manager_id === null ? null : Number(row.manager_id),
      }
    : null;
}

async function setStatus(client: pg.PoolClient, id: number, statut: RegistrationStatus) {
  await client.query(
    'UPDATE pl_registration_requests SET statut = $2, updated_at = now() WHERE id = $1',
    [id, statut],
  );
}

/** Avis du manager : seul le manager actuel du demandeur se prononce. */
export async function managerDecision(
  db: pg.Pool,
  actor: UserRecord,
  id: number,
  accept: boolean,
  commentaire: string,
): Promise<Outcome<RegistrationStatus>> {
  return transaction(db, async (client) => {
    const request = await lockRequest(client, id);
    if (!request || request.managerId !== actor.id) return NOT_FOUND;
    if (request.statut !== 'attente_manager') {
      return refuse(409, 'Cette demande n’attend plus votre validation.');
    }
    const statut = accept ? 'attente_formation' : 'refusee';
    await setStatus(client, id, statut);
    await addEvent(client, 'inscription', id, statut, actor, commentaire);
    return { ok: statut };
  });
}

/** Décision de l'équipe formation : la confirmation prend une place, s'il en reste. */
export async function trainingDecision(
  db: pg.Pool,
  actor: UserRecord,
  id: number,
  accept: boolean,
  commentaire: string,
): Promise<Outcome<RegistrationStatus>> {
  return transaction(db, async (client) => {
    const request = await lockRequest(client, id);
    if (!request) return NOT_FOUND;
    if (request.statut !== 'attente_formation') {
      return refuse(409, 'Cette demande n’attend pas de décision de l’équipe formation.');
    }
    if (accept) {
      const refusal = sessionRefusal(await lockSession(client, request.sessionId));
      if (refusal) return refusal;
      await client.query(
        `INSERT INTO pl_session_registrations (session_id, user_id, statut)
         VALUES ($1, $2, 'confirmee')
         ON CONFLICT (session_id, user_id) DO UPDATE SET statut = 'confirmee', created_at = now()`,
        [request.sessionId, request.userId],
      );
    }
    const statut = accept ? 'confirmee' : 'refusee';
    await setStatus(client, id, statut);
    await addEvent(client, 'inscription', id, statut, actor, commentaire);
    return { ok: statut };
  });
}

/** Le demandeur retire sa demande, ou se désinscrit avant le début de la session. */
export async function cancelRegistration(
  db: pg.Pool,
  actor: UserRecord,
  id: number,
): Promise<Outcome<RegistrationStatus>> {
  return transaction(db, async (client) => {
    const request = await lockRequest(client, id);
    if (!request || request.userId !== actor.id) return NOT_FOUND;
    if (!['attente_manager', 'attente_formation', 'confirmee'].includes(request.statut)) {
      return refuse(409, 'Cette demande est déjà close.');
    }
    if (request.statut === 'confirmee') {
      const session = await lockSession(client, request.sessionId);
      if (session && session.debut <= new Date()) {
        return refuse(409, 'La session a commencé : contactez l’équipe formation.');
      }
      await client.query(
        `UPDATE pl_session_registrations SET statut = 'annulee'
         WHERE session_id = $1 AND user_id = $2`,
        [request.sessionId, request.userId],
      );
    }
    await setStatus(client, id, 'annulee');
    await addEvent(client, 'inscription', id, 'annulee', actor);
    return { ok: 'annulee' };
  });
}

/** Annulation d'une session : les demandes en cours sont closes, les places libérées. */
export async function closeSessionRequests(
  client: pg.PoolClient,
  sessionId: number,
  actor: UserRecord,
): Promise<void> {
  const res = await client.query<{ id: string }>(
    `UPDATE pl_registration_requests SET statut = 'annulee', updated_at = now()
     WHERE session_id = $1 AND statut IN ('attente_manager', 'attente_formation', 'confirmee')
     RETURNING id`,
    [sessionId],
  );
  for (const row of res.rows) {
    await addEvent(
      client,
      'inscription',
      Number(row.id),
      'annulee',
      actor,
      'Session annulée par l’équipe formation.',
    );
  }
  await client.query(
    `UPDATE pl_session_registrations SET statut = 'annulee' WHERE session_id = $1`,
    [sessionId],
  );
}

export { transaction };

// ── Sessions sur mesure ──────────────────────────────────────────────────────

interface CustomRow {
  id: string;
  statut: CustomStatus;
  created_at: Date;
  requester_id: string;
  display_name: string;
  email: string;
  course_id: string | null;
  course_titre: string | null;
  sujet: string;
  modalite: CustomRequestView['modalite'];
  participants: number;
  periode: string;
  details: string;
}

async function customRequests(db: Db, where: string, params: unknown[]) {
  const res = await db.query<CustomRow>(
    `SELECT q.id, q.statut, q.created_at, q.requester_id, u.display_name, u.email, q.course_id,
       c.titre AS course_titre, q.sujet, q.modalite, q.participants, q.periode, q.details
     FROM pl_custom_requests q
     JOIN pl_users u ON u.id = q.requester_id
     LEFT JOIN pl_courses c ON c.id = q.course_id
     WHERE ${where} ORDER BY q.created_at DESC, q.id DESC`,
    params,
  );
  const history = await events(
    db,
    'sur_mesure',
    res.rows.map((r) => Number(r.id)),
  );
  return res.rows.map((row): CustomRequestView => ({
    id: Number(row.id),
    statut: row.statut,
    createdAt: row.created_at.toISOString(),
    demandeur: {
      id: Number(row.requester_id),
      displayName: row.display_name,
      email: row.email,
    },
    courseId: row.course_id,
    courseTitre: row.course_titre,
    sujet: row.sujet,
    modalite: row.modalite,
    participants: row.participants,
    periode: row.periode,
    details: row.details,
    historique: history.get(Number(row.id)) ?? [],
  }));
}

export async function customRequest(db: Db, id: number): Promise<CustomRequestView | null> {
  return (await customRequests(db, 'q.id = $1', [id]))[0] ?? null;
}

export const myCustomRequests = (db: pg.Pool, userId: number) =>
  customRequests(db, 'q.requester_id = $1', [userId]);

/** Demandes sur mesure ouvertes, puis celles closes depuis moins de 90 jours. */
export const trainingCustomRequests = (db: pg.Pool) =>
  customRequests(
    db,
    `q.statut IN ('a_traiter', 'en_cours') OR q.updated_at > now() - interval '90 days'`,
    [],
  );

export async function createCustomRequest(
  db: pg.Pool,
  actor: UserRecord,
  input: CustomCreate,
): Promise<number> {
  return transaction(db, async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO pl_custom_requests
         (requester_id, course_id, sujet, modalite, participants, periode, details, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'a_traiter') RETURNING id`,
      [
        actor.id,
        input.courseId,
        input.sujet,
        input.modalite,
        input.participants,
        input.periode,
        input.details,
      ],
    );
    const id = Number(res.rows[0]!.id);
    await addEvent(client, 'sur_mesure', id, 'a_traiter', actor);
    return id;
  });
}

async function lockCustom(client: pg.PoolClient, id: number) {
  const res = await client.query<{ statut: CustomStatus; requester_id: string }>(
    'SELECT statut, requester_id FROM pl_custom_requests WHERE id = $1 FOR UPDATE',
    [id],
  );
  const row = res.rows[0];
  return row ? { statut: row.statut, requesterId: Number(row.requester_id) } : null;
}

async function setCustomStatus(client: pg.PoolClient, id: number, statut: CustomStatus) {
  await client.query(
    'UPDATE pl_custom_requests SET statut = $2, updated_at = now() WHERE id = $1',
    [id, statut],
  );
}

export async function cancelCustomRequest(
  db: pg.Pool,
  actor: UserRecord,
  id: number,
): Promise<Outcome<CustomStatus>> {
  return transaction(db, async (client) => {
    const request = await lockCustom(client, id);
    if (!request || request.requesterId !== actor.id) return NOT_FOUND;
    if (!['a_traiter', 'en_cours'].includes(request.statut)) {
      return refuse(409, 'Cette demande est déjà close.');
    }
    await setCustomStatus(client, id, 'annulee');
    await addEvent(client, 'sur_mesure', id, 'annulee', actor);
    return { ok: 'annulee' };
  });
}

export async function processCustomRequest(
  db: pg.Pool,
  actor: UserRecord,
  id: number,
  input: CustomProcessing,
): Promise<Outcome<CustomStatus>> {
  return transaction(db, async (client) => {
    const request = await lockCustom(client, id);
    if (!request) return NOT_FOUND;
    if (!['a_traiter', 'en_cours'].includes(request.statut)) {
      return refuse(409, 'Cette demande est déjà close.');
    }
    await setCustomStatus(client, id, input.statut);
    await addEvent(client, 'sur_mesure', id, input.statut, actor, input.commentaire ?? '');
    return { ok: input.statut };
  });
}
