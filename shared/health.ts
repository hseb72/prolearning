import type { Space } from './spaces.js';

/** Réponse de GET /api/health. */
export interface HealthReport {
  status: 'ok' | 'degraded';
  /** Joignabilité de la base de chaque espace. */
  databases: Record<Space, 'ok' | 'unreachable'>;
}
