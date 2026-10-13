import type pg from 'pg';
import type { AccountSummary, UserRow } from '../../shared/auth.js';
import type { Role } from '../../shared/roles.js';
import { isInactive } from './privacy.js';

/** Ligne de pl_users. */
export interface UserRecord {
  id: number;
  oidcSubject: string | null;
  email: string;
  displayName: string;
  role: Role;
  managerId: number | null;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const COLUMNS = `id::int AS id, oidc_subject AS "oidcSubject", email, display_name AS "displayName",
  role, manager_id::int AS "managerId", active, last_login_at AS "lastLoginAt",
  created_at AS "createdAt"`;

export async function findUser(db: pg.Pool, id: number): Promise<UserRecord | null> {
  const res = await db.query<UserRecord>(`SELECT ${COLUMNS} FROM pl_users WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function listUsers(db: pg.Pool): Promise<UserRecord[]> {
  const res = await db.query<UserRecord>(
    `SELECT ${COLUMNS} FROM pl_users ORDER BY lower(display_name), id`,
  );
  return res.rows;
}

/**
 * Crée ou met à jour le compte d'une personne authentifiée par Keycloak. Le rattachement
 * se fait par `sub` ; à défaut, par e-mail, sur un compte encore sans identité Keycloak
 * (créé à l'avance par un administrateur, ou en développement).
 */
export async function upsertSsoUser(
  db: pg.Pool,
  identity: { subject: string; email: string; displayName: string },
): Promise<UserRecord> {
  const params = [identity.subject, identity.email, identity.displayName];
  const bySubject = await db.query<UserRecord>(
    `UPDATE pl_users SET email = $2, display_name = $3, last_login_at = now()
     WHERE oidc_subject = $1 RETURNING ${COLUMNS}`,
    params,
  );
  if (bySubject.rows[0]) return bySubject.rows[0];
  const byEmail = await db.query<UserRecord>(
    `UPDATE pl_users SET oidc_subject = $1, display_name = $3, last_login_at = now()
     WHERE lower(email) = lower($2) AND oidc_subject IS NULL RETURNING ${COLUMNS}`,
    params,
  );
  if (byEmail.rows[0]) return byEmail.rows[0];
  const created = await db.query<UserRecord>(
    `INSERT INTO pl_users (oidc_subject, email, display_name, last_login_at)
     VALUES ($1, $2, $3, now()) RETURNING ${COLUMNS}`,
    params,
  );
  return created.rows[0]!;
}

/** Compte de développement : rattaché par e-mail, sans identité Keycloak. */
export async function upsertDevUser(
  db: pg.Pool,
  identity: { email: string; displayName: string },
): Promise<UserRecord> {
  const res = await db.query<UserRecord>(
    `INSERT INTO pl_users (email, display_name, last_login_at)
     VALUES ($1, $2, now())
     ON CONFLICT ((lower(email))) DO UPDATE SET last_login_at = now()
     RETURNING ${COLUMNS}`,
    [identity.email, identity.displayName],
  );
  return res.rows[0]!;
}

export async function setRole(db: pg.Pool, id: number, role: Role): Promise<void> {
  await db.query('UPDATE pl_users SET role = $2 WHERE id = $1', [id, role]);
}

export async function setManager(db: pg.Pool, id: number, managerId: number | null): Promise<void> {
  await db.query('UPDATE pl_users SET manager_id = $2 WHERE id = $1', [id, managerId]);
}

export function toSummary(user: UserRecord): AccountSummary {
  return { id: user.id, displayName: user.displayName, email: user.email, role: user.role };
}

/** Ligne de la liste des comptes ; `inactiveMonths` signale les comptes sans connexion récente. */
export function toRow(user: UserRecord, inactiveMonths: number): UserRow {
  return {
    ...toSummary(user),
    managerId: user.managerId,
    active: user.active,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    dormant: isInactive(user, inactiveMonths),
  };
}
