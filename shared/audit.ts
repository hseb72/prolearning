/** Une ligne du journal d'audit, telle que l'API la renvoie (GET /api/journal). */
export interface AuditEntryView {
  id: number;
  occurredAt: string;
  actorLabel: string | null;
  action: string;
  details: Record<string, unknown>;
}

/** Une page du journal, de la plus récente à la plus ancienne. */
export interface AuditPage {
  entries: AuditEntryView[];
  /** Identifiant à passer en `avant` pour la page suivante ; absent à la fin. */
  next: number | null;
}

/** Familles d'actions proposées en filtre : préfixe du code d'action. */
export const AUDIT_FAMILIES = [
  'formation',
  'course',
  'session',
  'user',
  'space',
  'demo',
  'settings',
  'privacy',
  'login',
  'logout',
] as const;
export type AuditFamily = (typeof AUDIT_FAMILIES)[number];

export function isAuditFamily(value: unknown): value is AuditFamily {
  return typeof value === 'string' && (AUDIT_FAMILIES as readonly string[]).includes(value);
}
