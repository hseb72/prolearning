import type pg from 'pg';
import type {
  CourseCard,
  CourseDetail,
  CourseInput,
  Format,
  FormationOption,
  SessionInput,
  SessionView,
} from '../../../shared/catalog.js';

interface CourseRow {
  id: string;
  titre: string;
  theme: string;
  resume: string;
  objectifs: string[];
  public: string;
  prerequis: string;
  duree_heures: string | null;
  formation_id: string | null;
  formation_disponible: boolean;
  publiee: boolean;
}

interface SessionRow {
  id: string;
  course_id: string;
  course_titre: string;
  modalite: 'distance' | 'site';
  debut: Date;
  fin: Date;
  lieu: string;
  formateur: string;
  places: number;
  places_prises: string;
  annulee: boolean;
}

// Le parcours associé n'est proposé que s'il existe dans l'espace (publié en production,
// importé en démonstration).
const COURSE_COLUMNS = `c.id, c.titre, c.theme, c.resume, c.objectifs, c.public, c.prerequis,
  c.duree_heures, c.formation_id, (f.id IS NOT NULL) AS formation_disponible, c.publiee`;
const COURSE_FROM = 'pl_courses c LEFT JOIN pl_formations f ON f.id = c.formation_id';

// Seule une inscription confirmée occupe une place (étape 5 : demandes et validation).
const SESSION_SELECT = `SELECT s.id, s.course_id, c.titre AS course_titre, s.modalite, s.debut,
    s.fin, s.lieu, s.formateur, s.places, s.annulee,
    (SELECT count(*) FROM pl_session_registrations r
      WHERE r.session_id = s.id AND r.statut = 'confirmee') AS places_prises
  FROM pl_course_sessions s JOIN pl_courses c ON c.id = s.course_id`;

function toSession(row: SessionRow): SessionView {
  return {
    id: Number(row.id),
    courseId: row.course_id,
    courseTitre: row.course_titre,
    modalite: row.modalite,
    debut: row.debut.toISOString(),
    fin: row.fin.toISOString(),
    lieu: row.lieu,
    formateur: row.formateur,
    places: row.places,
    placesRestantes: Math.max(0, row.places - Number(row.places_prises)),
    annulee: row.annulee,
  };
}

/** Une session est ouverte si elle n'est ni annulée ni commencée. */
export function isOpen(session: SessionView, now = new Date()): boolean {
  return !session.annulee && new Date(session.debut) > now;
}

function toCard(row: CourseRow, sessions: SessionView[]): CourseCard {
  const open = sessions.filter((s) => isOpen(s));
  const formationId = row.formation_disponible ? row.formation_id : null;
  const formats: Format[] = [];
  for (const m of ['distance', 'site'] as const) {
    if (open.some((s) => s.modalite === m)) formats.push(m);
  }
  if (formationId) formats.push('en-ligne');
  return {
    id: row.id,
    titre: row.titre,
    theme: row.theme,
    resume: row.resume,
    dureeHeures: row.duree_heures === null ? null : Number(row.duree_heures),
    formationId,
    formats,
    prochaineSession: open[0]?.debut ?? null,
    publiee: row.publiee,
  };
}

async function sessionsOf(db: pg.Pool, courseIds: string[]): Promise<SessionView[]> {
  if (!courseIds.length) return [];
  const res = await db.query<SessionRow>(
    `${SESSION_SELECT} WHERE s.course_id = ANY($1) ORDER BY s.debut, s.id`,
    [courseIds],
  );
  return res.rows.map(toSession);
}

/** Fiches du catalogue ; les fiches non publiées ne sont listées que pour l'équipe formation. */
export async function listCourses(db: pg.Pool, includeDrafts: boolean): Promise<CourseCard[]> {
  const res = await db.query<CourseRow>(
    `SELECT ${COURSE_COLUMNS} FROM ${COURSE_FROM}
     WHERE c.publiee OR $1 ORDER BY c.theme, c.titre`,
    [includeDrafts],
  );
  const sessions = await sessionsOf(
    db,
    res.rows.map((r) => r.id),
  );
  return res.rows.map((row) =>
    toCard(
      row,
      sessions.filter((s) => s.courseId === row.id),
    ),
  );
}

/**
 * Fiche détaillée. Les collaborateurs ne voient que les fiches publiées et les sessions à
 * venir non annulées ; l'équipe formation voit tout.
 */
export async function getCourse(
  db: pg.Pool,
  id: string,
  manager: boolean,
): Promise<CourseDetail | null> {
  const res = await db.query<CourseRow>(
    `SELECT ${COURSE_COLUMNS} FROM ${COURSE_FROM} WHERE c.id = $1`,
    [id],
  );
  const row = res.rows[0];
  if (!row || (!row.publiee && !manager)) return null;
  const all = await sessionsOf(db, [id]);
  return {
    ...toCard(row, all),
    objectifs: row.objectifs,
    public: row.public,
    prerequis: row.prerequis,
    sessions: manager ? all : all.filter((s) => isOpen(s)),
    mesDemandes: {},
  };
}

export async function courseExists(db: pg.Pool, id: string): Promise<boolean> {
  const res = await db.query('SELECT 1 FROM pl_courses WHERE id = $1', [id]);
  return res.rowCount === 1;
}

export async function formationExists(db: pg.Pool, id: string): Promise<boolean> {
  const res = await db.query('SELECT 1 FROM pl_formations WHERE id = $1', [id]);
  return res.rowCount === 1;
}

export async function createCourse(db: pg.Pool, input: CourseInput, by: number): Promise<void> {
  await db.query(
    `INSERT INTO pl_courses (id, titre, theme, resume, objectifs, public, prerequis,
       duree_heures, formation_id, publiee, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      input.id,
      input.titre,
      input.theme,
      input.resume,
      input.objectifs,
      input.public,
      input.prerequis,
      input.dureeHeures,
      input.formationId,
      input.publiee,
      by,
    ],
  );
}

/** Met à jour une fiche (son identifiant ne change pas : il est dans les adresses). */
export async function updateCourse(
  db: pg.Pool,
  id: string,
  input: Omit<CourseInput, 'id'>,
  by: number,
): Promise<boolean> {
  const res = await db.query(
    `UPDATE pl_courses SET titre = $2, theme = $3, resume = $4, objectifs = $5, public = $6,
       prerequis = $7, duree_heures = $8, formation_id = $9, publiee = $10, updated_by = $11,
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      input.titre,
      input.theme,
      input.resume,
      input.objectifs,
      input.public,
      input.prerequis,
      input.dureeHeures,
      input.formationId,
      input.publiee,
      by,
    ],
  );
  return res.rowCount === 1;
}

/** Sessions à venir (non commencées) de toutes les fiches publiées, ouvertes ou annulées. */
export async function upcomingSessions(db: pg.Pool): Promise<SessionView[]> {
  const res = await db.query<SessionRow>(
    `${SESSION_SELECT} WHERE c.publiee AND s.debut > now() AND NOT s.annulee
     ORDER BY s.debut, s.id`,
  );
  return res.rows.map(toSession);
}

export async function getSession(db: pg.Pool, id: number): Promise<SessionView | null> {
  const res = await db.query<SessionRow>(`${SESSION_SELECT} WHERE s.id = $1`, [id]);
  return res.rows[0] ? toSession(res.rows[0]) : null;
}

export async function createSession(
  db: pg.Pool,
  courseId: string,
  input: SessionInput,
): Promise<number> {
  const res = await db.query<{ id: string }>(
    `INSERT INTO pl_course_sessions (course_id, modalite, debut, fin, lieu, formateur, places)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [courseId, input.modalite, input.debut, input.fin, input.lieu, input.formateur, input.places],
  );
  return Number(res.rows[0]!.id);
}

export async function updateSession(db: pg.Pool, id: number, input: SessionInput): Promise<void> {
  await db.query(
    `UPDATE pl_course_sessions SET modalite = $2, debut = $3, fin = $4, lieu = $5,
       formateur = $6, places = $7, updated_at = now()
     WHERE id = $1`,
    [id, input.modalite, input.debut, input.fin, input.lieu, input.formateur, input.places],
  );
}

export async function cancelSession(db: pg.Pool | pg.PoolClient, id: number): Promise<void> {
  await db.query('UPDATE pl_course_sessions SET annulee = true, updated_at = now() WHERE id = $1', [
    id,
  ]);
}

/** Parcours en ligne de l'espace, à associer à une fiche. */
export async function formationOptions(db: pg.Pool): Promise<FormationOption[]> {
  const res = await db.query<FormationOption>(
    `SELECT f.id, v.titre FROM pl_formations f
     JOIN pl_formation_versions v ON v.formation_id = f.id AND v.version = f.current_version
     ORDER BY v.titre`,
  );
  return res.rows;
}
