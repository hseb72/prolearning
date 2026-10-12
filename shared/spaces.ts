/**
 * Espaces de données (cf. CLAUDE.md, « Espaces »).
 *
 * Chaque espace a sa propre base PostgreSQL : aucune requête ne peut les mélanger.
 * La production est l'espace par défaut, le seul visible des non-administrateurs.
 */
export const SPACES = ['production', 'demo'] as const;

export type Space = (typeof SPACES)[number];

/**
 * Bases de données : une par espace, plus celle de l'évaluation, où vivent les formations
 * importées en attente de relecture. L'évaluation n'est pas un espace qu'on « bascule » :
 * c'est une zone de l'administration, que la réinitialisation de la démo ne touche jamais.
 */
export const DATABASE_NAMES = ['production', 'demo', 'evaluation'] as const;

export type DatabaseName = (typeof DATABASE_NAMES)[number];

export const DEFAULT_SPACE: Space = 'production';

export function isSpace(value: unknown): value is Space {
  return typeof value === 'string' && (SPACES as readonly string[]).includes(value);
}
