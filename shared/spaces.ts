/**
 * Espaces de données (cf. CLAUDE.md, « Espaces production et démonstration »).
 *
 * Chaque espace a sa propre base PostgreSQL : aucune requête ne peut les mélanger.
 * La production est l'espace par défaut, le seul visible des non-administrateurs.
 */
export const SPACES = ['production', 'demo'] as const;

export type Space = (typeof SPACES)[number];

export const DEFAULT_SPACE: Space = 'production';

export function isSpace(value: unknown): value is Space {
  return typeof value === 'string' && (SPACES as readonly string[]).includes(value);
}
