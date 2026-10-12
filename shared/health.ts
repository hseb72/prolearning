import type { DatabaseName } from './spaces.js';

/** Réponse de GET /api/health. */
export interface HealthReport {
  status: 'ok' | 'degraded';
  /** Joignabilité de chaque base (production, démonstration, évaluation). */
  databases: Record<DatabaseName, 'ok' | 'unreachable'>;
}
