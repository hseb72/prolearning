import type pg from 'pg';
import {
  DEFAULT_RETENTION,
  RETENTION_BOUNDS,
  type PurgeSummary,
  type RetentionSettings,
} from '../../shared/privacy.js';

/**
 * Données personnelles (CLAUDE.md, étape 7) : durées de conservation, purge, export et
 * suppression des données d'une personne. Chaque fonction agit sur une seule base, celle
 * de l'espace concerné.
 */

export function isValidRetention(value: unknown): value is RetentionSettings {
  if (typeof value !== 'object' || value === null) return false;
  return (Object.keys(RETENTION_BOUNDS) as (keyof RetentionSettings)[]).every((key) => {
    const n = (value as Record<string, unknown>)[key];
    const { min, max } = RETENTION_BOUNDS[key];
    return Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  });
}

export async function getRetention(db: pg.Pool | pg.PoolClient): Promise<RetentionSettings> {
  const res = await db.query<{ value: unknown }>(
    "SELECT value FROM pl_settings WHERE key = 'retention'",
  );
  const value = res.rows[0]?.value;
  return isValidRetention(value) ? value : DEFAULT_RETENTION;
}

export async function setRetention(
  db: pg.Pool,
  value: RetentionSettings,
  actorId: number,
): Promise<void> {
  await db.query(
    `INSERT INTO pl_settings (key, value, updated_at, updated_by) VALUES ('retention', $1, now(), $2)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now(), updated_by = $2`,
    [JSON.stringify(value), actorId],
  );
}

/**
 * Supprime ce qui a dépassé sa durée de conservation : demandes clôturées (avec leur
 * historique et, pour une inscription confirmée, la place occupée), et lignes du journal.
 * Une demande est clôturée quand elle est refusée ou annulée (date de la dernière mise à
 * jour), ou, pour une inscription confirmée, quand la session est terminée.
 */
export async function purgeExpiredData(db: pg.Pool, now = new Date()): Promise<PurgeSummary> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { requestsMonths, auditMonths } = await getRetention(client);
    const inscriptions = await client.query<{
      id: string;
      session_id: string;
      user_id: string;
      statut: string;
    }>(
      `DELETE FROM pl_registration_requests r
        USING pl_course_sessions s
        WHERE s.id = r.session_id
          AND CASE r.statut
                WHEN 'confirmee' THEN s.fin
                WHEN 'refusee' THEN r.updated_at
                WHEN 'annulee' THEN r.updated_at
              END < $1::timestamptz - make_interval(months => $2)
        RETURNING r.id, r.session_id, r.user_id, r.statut`,
      [now, requestsMonths],
    );
    const confirmed = inscriptions.rows.filter((r) => r.statut === 'confirmee');
    if (confirmed.length) {
      await client.query(
        `DELETE FROM pl_session_registrations sr
          USING unnest($1::bigint[], $2::bigint[]) AS gone(session_id, user_id)
          WHERE sr.session_id = gone.session_id AND sr.user_id = gone.user_id`,
        [confirmed.map((r) => r.session_id), confirmed.map((r) => r.user_id)],
      );
    }
    const surMesure = await client.query<{ id: string }>(
      `DELETE FROM pl_custom_requests
        WHERE statut IN ('acceptee', 'refusee', 'annulee')
          AND updated_at < $1::timestamptz - make_interval(months => $2)
        RETURNING id`,
      [now, requestsMonths],
    );
    await deleteEvents(
      client,
      'inscription',
      inscriptions.rows.map((r) => r.id),
    );
    await deleteEvents(
      client,
      'sur_mesure',
      surMesure.rows.map((r) => r.id),
    );
    const journal = await client.query(
      `DELETE FROM pl_audit_log WHERE occurred_at < $1::timestamptz - make_interval(months => $2)`,
      [now, auditMonths],
    );
    await client.query('COMMIT');
    return {
      inscriptions: inscriptions.rowCount ?? 0,
      surMesure: surMesure.rowCount ?? 0,
      journal: journal.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteEvents(
  client: pg.PoolClient,
  kind: 'inscription' | 'sur_mesure',
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  await client.query(
    'DELETE FROM pl_request_events WHERE kind = $1 AND request_id = ANY($2::bigint[])',
    [kind, ids],
  );
}

/** Toutes les données tenues sur une personne dans cet espace, lisibles et réutilisables. */
export async function exportUserData(
  db: pg.Pool,
  userId: number,
  now = new Date(),
): Promise<Record<string, unknown> | null> {
  const account = await db.query(
    `SELECT u.email, u.display_name AS "nom", u.role, m.display_name AS "manager",
            u.active AS "actif", u.created_at AS "creeLe", u.last_login_at AS "derniereConnexion"
       FROM pl_users u LEFT JOIN pl_users m ON m.id = u.manager_id
      WHERE u.id = $1`,
    [userId],
  );
  if (!account.rows[0]) return null;
  const q = async (sql: string) => (await db.query(sql, [userId])).rows;
  return {
    exporteLe: now.toISOString(),
    compte: account.rows[0],
    parcours: {
      activites: await q(
        `SELECT formation_id AS "formation", module_id AS "module", activite_id AS "activite",
                activite_type AS "type", status AS "statut", best_score::float AS "meilleurScore",
                points, attempts AS "tentatives", first_done_at AS "faiteLe", updated_at AS "misAJourLe"
           FROM pl_activity_results WHERE user_id = $1 ORDER BY formation_id, module_id, activite_id`,
      ),
      modulesTermines: await q(
        `SELECT formation_id AS "formation", module_id AS "module", bonus, completed_at AS "termineLe"
           FROM pl_module_completions WHERE user_id = $1 ORDER BY completed_at`,
      ),
      tentativesDeQuiz: await q(
        `SELECT formation_id AS "formation", module_id AS "module", activite_id AS "activite",
                created_at AS "commenceeLe", submitted_at AS "corrigeeLe"
           FROM pl_quiz_attempts WHERE user_id = $1 ORDER BY created_at`,
      ),
    },
    inscriptions: await q(
      `SELECT c.titre AS "formation", s.debut, s.fin, s.modalite, r.statut, r.motif AS "message",
              r.created_at AS "demandeeLe", r.updated_at AS "misAJourLe",
              COALESCE((SELECT json_agg(json_build_object('statut', e.statut, 'par', e.actor_name,
                        'commentaire', e.commentaire, 'le', e.created_at) ORDER BY e.id)
                          FROM pl_request_events e
                         WHERE e.kind = 'inscription' AND e.request_id = r.id), '[]') AS "historique"
         FROM pl_registration_requests r
         JOIN pl_course_sessions s ON s.id = r.session_id
         JOIN pl_courses c ON c.id = s.course_id
        WHERE r.user_id = $1 ORDER BY r.created_at`,
    ),
    sessionsSurMesure: await q(
      `SELECT r.sujet, c.titre AS "formation", r.modalite, r.participants, r.periode, r.details,
              r.statut, r.created_at AS "demandeeLe", r.updated_at AS "misAJourLe",
              COALESCE((SELECT json_agg(json_build_object('statut', e.statut, 'par', e.actor_name,
                        'commentaire', e.commentaire, 'le', e.created_at) ORDER BY e.id)
                          FROM pl_request_events e
                         WHERE e.kind = 'sur_mesure' AND e.request_id = r.id), '[]') AS "historique"
         FROM pl_custom_requests r LEFT JOIN pl_courses c ON c.id = r.course_id
        WHERE r.requester_id = $1 ORDER BY r.created_at`,
    ),
    reussitesPubliees: await q(
      `SELECT formation_id AS "formation", visibility AS "visibilite", updated_at AS "publieeLe"
         FROM pl_achievement_shares WHERE user_id = $1 ORDER BY formation_id`,
    ),
    actionsSurLesDemandesDesAutres: await q(
      `SELECT kind AS "type", statut, commentaire, created_at AS "le"
         FROM pl_request_events WHERE actor_id = $1 ORDER BY id`,
    ),
  };
}

/** Libellé qui remplace le nom d'une personne supprimée dans l'historique des demandes. */
export const DELETED_ACTOR = 'Compte supprimé';

/**
 * Supprime une personne et ses données de cet espace : compte, connexions, progression,
 * demandes et leur historique, places occupées (libérées). Son nom disparaît aussi de
 * l'historique des demandes des autres. Le journal d'audit garde ses actions jusqu'à sa
 * propre purge (obligation de traçabilité).
 */
export async function deleteUserData(db: pg.Pool, userId: number): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const registrations = await client.query<{ id: string }>(
      'SELECT id FROM pl_registration_requests WHERE user_id = $1',
      [userId],
    );
    const custom = await client.query<{ id: string }>(
      'SELECT id FROM pl_custom_requests WHERE requester_id = $1',
      [userId],
    );
    await deleteEvents(
      client,
      'inscription',
      registrations.rows.map((r) => r.id),
    );
    await deleteEvents(
      client,
      'sur_mesure',
      custom.rows.map((r) => r.id),
    );
    await client.query(
      'UPDATE pl_request_events SET actor_name = $2, actor_id = NULL WHERE actor_id = $1',
      [userId, DELETED_ACTOR],
    );
    // Le reste suit par ON DELETE CASCADE (connexions, progression, demandes, places).
    const deleted = await client.query('DELETE FROM pl_users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    return (deleted.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Comptes sans connexion depuis plus de `months` mois (ou jamais connectés depuis). */
export function isInactive(
  user: { lastLoginAt: Date | null; createdAt: Date; oidcSubject: string | null },
  months: number,
  now = new Date(),
): boolean {
  // Les comptes fictifs de la démonstration ne se connectent jamais : on ne les signale pas.
  if (!user.oidcSubject && !user.lastLoginAt) return false;
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() - months);
  return (user.lastLoginAt ?? user.createdAt) < limit;
}
