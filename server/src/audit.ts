import type pg from 'pg';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'space.switch'
  | 'user.role'
  | 'user.manager'
  | 'user.bootstrap_admin'
  | 'formation.import'
  | 'formation.publish';

export interface AuditEntry {
  actorId: number | null;
  actorLabel: string | null;
  action: AuditAction;
  details?: Record<string, unknown>;
}

/** Inscrit une action au journal de la base donnée (celle de l'espace où elle a lieu). */
export async function audit(db: pg.Pool | pg.PoolClient, entry: AuditEntry): Promise<void> {
  await db.query(
    'INSERT INTO pl_audit_log (actor_id, actor_label, action, details) VALUES ($1, $2, $3, $4)',
    [entry.actorId, entry.actorLabel, entry.action, JSON.stringify(entry.details ?? {})],
  );
}
