import type pg from 'pg';
import {
  MAX_DELEGATION_DAYS,
  type DelegationPerson,
  type DelegationView,
} from '../../shared/delegations.js';
import { hasRole } from '../../shared/roles.js';
import { audit } from './audit.js';
import type { UserRecord } from './users.js';

type Db = pg.Pool | pg.PoolClient;

/** Aujourd'hui, à Paris : les suppléances se comptent en jours de Paris. */
const TODAY = `(now() AT TIME ZONE 'Europe/Paris')::date`;

const SELECT = `SELECT d.debut::text AS debut, d.fin::text AS fin,
    CASE WHEN d.debut > ${TODAY} THEN 'a_venir' ELSE 'en_cours' END AS etat,
    m.id::int AS "managerId", m.display_name AS "managerName", m.email AS "managerEmail",
    s.id::int AS "delegateId", s.display_name AS "delegateName", s.email AS "delegateEmail"
  FROM pl_delegations d
  JOIN pl_users m ON m.id = d.manager_id
  JOIN pl_users s ON s.id = d.delegate_id`;

interface Row {
  debut: string;
  fin: string;
  etat: DelegationView['etat'];
  managerId: number;
  managerName: string;
  managerEmail: string;
  delegateId: number;
  delegateName: string;
  delegateEmail: string;
}

function toView(row: Row): DelegationView {
  return {
    manager: { id: row.managerId, displayName: row.managerName, email: row.managerEmail },
    suppleant: { id: row.delegateId, displayName: row.delegateName, email: row.delegateEmail },
    debut: row.debut,
    fin: row.fin,
    etat: row.etat,
  };
}

/** Suppléance en cours ou à venir d'un manager ; une suppléance terminée ne compte plus. */
export async function delegationOf(db: Db, managerId: number): Promise<DelegationView | null> {
  const res = await db.query<Row>(`${SELECT} WHERE d.manager_id = $1 AND d.fin >= ${TODAY}`, [
    managerId,
  ]);
  return res.rows[0] ? toView(res.rows[0]) : null;
}

/** Managers qu'une personne supplée aujourd'hui ou suppléera. */
export async function delegationsTo(db: Db, delegateId: number): Promise<DelegationView[]> {
  const res = await db.query<Row>(
    `${SELECT} WHERE d.delegate_id = $1 AND d.fin >= ${TODAY} AND m.active
      ORDER BY d.debut, lower(m.display_name)`,
    [delegateId],
  );
  return res.rows.map(toView);
}

/** Vrai si `delegateId` supplée `managerId` aujourd'hui. */
export async function isActiveDelegate(
  db: Db,
  delegateId: number,
  managerId: number,
): Promise<boolean> {
  const res = await db.query(
    `SELECT 1 FROM pl_delegations
      WHERE manager_id = $1 AND delegate_id = $2 AND ${TODAY} BETWEEN debut AND fin`,
    [managerId, delegateId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Personnes qui peuvent suppléer ce manager : tout compte actif, sauf lui-même. */
export async function delegateCandidates(db: Db, managerId: number): Promise<DelegationPerson[]> {
  const res = await db.query<DelegationPerson>(
    `SELECT id::int, display_name AS "displayName", email FROM pl_users
      WHERE active AND id <> $1 ORDER BY lower(display_name), id`,
    [managerId],
  );
  return res.rows;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export type DelegationOutcome = { ok: DelegationView } | { refus: string };

/**
 * Désigne (ou remplace) le suppléant d'un manager pour une période. Le manager garde la
 * main : son suppléant valide en plus de lui, pas à sa place. Journalisé.
 */
export async function setDelegation(
  db: pg.Pool,
  manager: UserRecord,
  update: { suppleantId: number; debut: string; fin: string },
  actor: UserRecord,
): Promise<DelegationOutcome> {
  const { suppleantId, debut, fin } = update;
  if (!hasRole(manager.role, 'manager') || !manager.active) {
    return { refus: 'Seul un manager peut avoir un suppléant.' };
  }
  if (suppleantId === manager.id)
    return { refus: 'Un manager ne peut pas être son propre suppléant.' };
  if (!isDate(debut) || !isDate(fin)) return { refus: 'Dates invalides.' };
  if (fin < debut) return { refus: 'La fin de la suppléance précède son début.' };
  const days = (Date.parse(fin) - Date.parse(debut)) / 86_400_000 + 1;
  if (days > MAX_DELEGATION_DAYS) {
    return { refus: `Une suppléance dure au plus ${MAX_DELEGATION_DAYS} jours.` };
  }
  const today = await db.query<{ today: string }>(`SELECT ${TODAY}::text AS today`);
  if (fin < today.rows[0]!.today) return { refus: 'Cette période est déjà terminée.' };
  const delegate = await db.query<{ active: boolean }>(
    'SELECT active FROM pl_users WHERE id = $1',
    [suppleantId],
  );
  if (!delegate.rows[0]?.active) return { refus: 'Le suppléant choisi n’est pas un compte actif.' };

  await db.query(
    `INSERT INTO pl_delegations (manager_id, delegate_id, debut, fin, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (manager_id) DO UPDATE
       SET delegate_id = $2, debut = $3, fin = $4, created_by = $5, created_at = now()`,
    [manager.id, suppleantId, debut, fin, actor.id],
  );
  await audit(db, {
    actorId: actor.id,
    actorLabel: actor.email,
    action: 'delegation.set',
    details: { managerId: manager.id, delegateId: suppleantId, debut, fin },
  });
  return { ok: (await delegationOf(db, manager.id))! };
}

/** Met fin à la suppléance d'un manager (en cours ou à venir). Journalisé. */
export async function endDelegation(
  db: pg.Pool,
  managerId: number,
  actor: UserRecord,
): Promise<boolean> {
  const res = await db.query('DELETE FROM pl_delegations WHERE manager_id = $1', [managerId]);
  if (!res.rowCount) return false;
  await audit(db, {
    actorId: actor.id,
    actorLabel: actor.email,
    action: 'delegation.end',
    details: { managerId },
  });
  return true;
}

/** Efface les suppléances terminées (purge quotidienne) ; le journal en garde la trace. */
export async function purgeEndedDelegations(db: Db): Promise<number> {
  const res = await db.query(`DELETE FROM pl_delegations WHERE fin < ${TODAY}`);
  return res.rowCount ?? 0;
}
