import type pg from 'pg';
import { DEFAULT_POINTS, MODULE_BONUS, badgesFor, levelFor } from '../../../shared/gamification.js';
import type {
  ActivityState,
  ActivityStatus,
  FormationProgress,
  LearnerProfile,
} from '../../../shared/learning.js';
import { isMandatory, type RawActivity, type RawFormation } from './content.js';

interface ResultRow {
  module_id: string;
  activite_id: string;
  activite_type: string;
  status: Exclude<ActivityStatus, 'a-faire'>;
  best_score: string | null;
  points: number;
}

/** Points par défaut d'une activité (§ 10), sauf si le contenu les fixe (`points`). */
export function defaultPoints(activity: RawActivity, unit = 1): number {
  const override = activity['points'] as number | undefined;
  if (override !== undefined) return override;
  return DEFAULT_POINTS[activity.type as keyof typeof DEFAULT_POINTS] * unit;
}

/** Une activité obligatoire compte comme faite ; un quiz obligatoire doit être réussi (§ 4). */
function counts(activity: RawActivity, state: ActivityState | undefined): boolean {
  if (!state) return false;
  return activity.type === 'quiz'
    ? state.statut === 'reussie'
    : state.statut !== 'a-faire' && state.statut !== 'echouee';
}

async function results(
  db: pg.Pool | pg.PoolClient,
  userId: number,
  formationId: string,
): Promise<ResultRow[]> {
  const res = await db.query<ResultRow>(
    `SELECT module_id, activite_id, activite_type, status, best_score, points
     FROM pl_activity_results WHERE user_id = $1 AND formation_id = $2`,
    [userId, formationId],
  );
  return res.rows;
}

async function completions(db: pg.Pool | pg.PoolClient, userId: number, formationId: string) {
  const res = await db.query<{ module_id: string; bonus: number }>(
    'SELECT module_id, bonus FROM pl_module_completions WHERE user_id = $1 AND formation_id = $2',
    [userId, formationId],
  );
  return res.rows;
}

/**
 * Progression calculée contre la version COURANTE de la formation : les résultats
 * d'activités qui n'y figurent plus sont ignorés, ceux dont l'identifiant est resté
 * comptent toujours. Déblocage séquentiel : un module s'ouvre quand le précédent est
 * terminé (§ 4).
 */
export async function formationProgress(
  db: pg.Pool | pg.PoolClient,
  userId: number,
  formation: RawFormation,
): Promise<FormationProgress> {
  const rows = await results(db, userId, formation.id);
  const bonuses = await completions(db, userId, formation.id);
  const byKey = new Map(rows.map((r) => [`${r.module_id}/${r.activite_id}`, r]));

  const activites: FormationProgress['activites'] = {};
  const modules: FormationProgress['modules'] = {};
  let points = 0;
  let previousDone = true;
  for (const module of formation.modules) {
    activites[module.id] = {};
    let done = true;
    for (const activity of module.activites) {
      const row = byKey.get(`${module.id}/${activity.id}`);
      const state: ActivityState = row
        ? {
            statut: row.status,
            points: row.points,
            score: row.best_score === null ? null : Number(row.best_score),
          }
        : { statut: 'a-faire', points: 0, score: null };
      activites[module.id]![activity.id] = state;
      points += state.points;
      if (isMandatory(activity) && !counts(activity, state)) done = false;
    }
    const debloque = formation.progression.deblocage === 'libre' || previousDone;
    modules[module.id] = { debloque, termine: done };
    previousDone = done;
  }
  points += bonuses
    .filter((b) => formation.modules.some((m) => m.id === b.module_id))
    .reduce((sum, b) => sum + b.bonus, 0);
  return {
    activites,
    modules,
    points,
    terminee: formation.modules.every((m) => modules[m.id]!.termine),
  };
}

/**
 * Enregistre un résultat en gardant le meilleur (statut, score, points), puis accorde le
 * bonus de module s'il vient d'être terminé. Renvoie l'état de l'activité et si le module
 * vient d'être terminé.
 */
export async function recordResult(
  db: pg.Pool,
  userId: number,
  formation: RawFormation,
  moduleId: string,
  activity: RawActivity,
  result: { status: Exclude<ActivityStatus, 'a-faire'>; score: number | null; points: number },
): Promise<{ etat: ActivityState; moduleTermine: boolean }> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO pl_activity_results
         (user_id, formation_id, module_id, activite_id, activite_type, status, best_score, points, attempts, first_done_at)
       VALUES ($1, $2, $3, $4, $5, $6::varchar, $7::numeric, $8, 1,
               CASE WHEN $6::varchar <> 'echouee' THEN now() END)
       ON CONFLICT (user_id, formation_id, module_id, activite_id) DO UPDATE SET
         status = CASE WHEN (CASE EXCLUDED.status WHEN 'reussie' THEN 2 WHEN 'faite' THEN 1 ELSE 0 END)
                          > (CASE pl_activity_results.status WHEN 'reussie' THEN 2 WHEN 'faite' THEN 1 ELSE 0 END)
                       THEN EXCLUDED.status ELSE pl_activity_results.status END,
         best_score = GREATEST(pl_activity_results.best_score, EXCLUDED.best_score),
         points = GREATEST(pl_activity_results.points, EXCLUDED.points),
         attempts = pl_activity_results.attempts + 1,
         first_done_at = COALESCE(pl_activity_results.first_done_at, EXCLUDED.first_done_at),
         activite_type = EXCLUDED.activite_type,
         updated_at = now()`,
      [
        userId,
        formation.id,
        moduleId,
        activity.id,
        activity.type,
        result.status,
        result.score,
        result.points,
      ],
    );
    const progress = await formationProgress(client, userId, formation);
    let moduleTermine = false;
    if (progress.modules[moduleId]?.termine) {
      const inserted = await client.query(
        `INSERT INTO pl_module_completions (user_id, formation_id, module_id, bonus)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [userId, formation.id, moduleId, MODULE_BONUS],
      );
      moduleTermine = inserted.rowCount === 1;
    }
    await client.query('COMMIT');
    return { etat: progress.activites[moduleId]![activity.id]!, moduleTermine };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Points, niveau et badges de l'apprenant dans l'espace (toutes formations confondues). */
export async function learnerProfile(
  db: pg.Pool,
  userId: number,
  formations: RawFormation[],
): Promise<LearnerProfile> {
  const totals = await db.query<{ points: string; done: string; perfect: string; stars: string }>(
    `SELECT COALESCE(SUM(points), 0) AS points,
            COUNT(*) FILTER (WHERE status IN ('faite', 'reussie')) AS done,
            COUNT(*) FILTER (WHERE activite_type = 'quiz' AND best_score >= 1) AS perfect,
            COUNT(*) FILTER (WHERE activite_type = 'scenario' AND best_score >= 3) AS stars
     FROM pl_activity_results WHERE user_id = $1`,
    [userId],
  );
  const bonus = await db.query<{ total: string; modules: string }>(
    'SELECT COALESCE(SUM(bonus), 0) AS total, COUNT(*) AS modules FROM pl_module_completions WHERE user_id = $1',
    [userId],
  );
  let formationsTerminees = 0;
  for (const formation of formations) {
    if ((await formationProgress(db, userId, formation)).terminee) formationsTerminees++;
  }
  const t = totals.rows[0]!;
  const points = Number(t.points) + Number(bonus.rows[0]!.total);
  return {
    points,
    niveau: levelFor(points),
    badges: badgesFor({
      activitesTerminees: Number(t.done),
      modulesTermines: Number(bonus.rows[0]!.modules),
      quizParfaits: Number(t.perfect),
      scenariosTroisEtoiles: Number(t.stars),
      formationsTerminees,
    }),
  };
}
