import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import type { Space } from '../../../shared/spaces.js';

/** Nom du cookie de session (HttpOnly, posé sur le domaine du front). */
export const SESSION_COOKIE = 'pl_session';

export interface SessionRecord {
  userId: number;
  activeSpace: Space;
  demoPersonaId: number | null;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Crée une session dans la base de PRODUCTION et renvoie le jeton en clair (seule son
 * empreinte est stockée). Une session commence toujours en production.
 */
export async function createSession(
  production: pg.Pool,
  userId: number,
  days: number,
  userAgent?: string,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await production.query(
    `INSERT INTO pl_sessions (token_hash, user_id, expires_at, user_agent)
     VALUES ($1, $2, now() + make_interval(days => $3), $4)`,
    [hashToken(token), userId, days, userAgent?.slice(0, 255) ?? null],
  );
  return token;
}

export async function resolveSession(
  production: pg.Pool,
  token: string,
): Promise<SessionRecord | null> {
  const res = await production.query<SessionRecord>(
    `SELECT user_id::int AS "userId", active_space AS "activeSpace",
            demo_persona_id::int AS "demoPersonaId"
     FROM pl_sessions WHERE token_hash = $1 AND expires_at > now()`,
    [hashToken(token)],
  );
  return res.rows[0] ?? null;
}

export async function setSessionSpace(
  production: pg.Pool,
  token: string,
  space: Space,
  demoPersonaId: number | null,
): Promise<void> {
  await production.query(
    'UPDATE pl_sessions SET active_space = $2, demo_persona_id = $3 WHERE token_hash = $1',
    [hashToken(token), space, space === 'demo' ? demoPersonaId : null],
  );
}

export async function deleteSession(production: pg.Pool, token: string): Promise<void> {
  await production.query('DELETE FROM pl_sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** Purge des sessions et connexions OIDC expirées (minimisation des données). */
export async function purgeExpired(production: pg.Pool): Promise<void> {
  await production.query('DELETE FROM pl_sessions WHERE expires_at <= now()');
  await production.query('DELETE FROM pl_oidc_requests WHERE expires_at <= now()');
}
