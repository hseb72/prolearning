/**
 * Durées de conservation (données personnelles, CLAUDE.md étape 7), en mois. Les demandes
 * clôturées et le journal sont purgés au-delà ; un compte sans connexion depuis plus de
 * `inactiveMonths` est signalé aux administrateurs, jamais supprimé d'office.
 */
export interface RetentionSettings {
  requestsMonths: number;
  auditMonths: number;
  inactiveMonths: number;
}

export const DEFAULT_RETENTION: RetentionSettings = {
  requestsMonths: 36,
  auditMonths: 12,
  inactiveMonths: 12,
};

/** Bornes acceptées pour chaque durée (en mois). */
export const RETENTION_BOUNDS: Record<keyof RetentionSettings, { min: number; max: number }> = {
  requestsMonths: { min: 6, max: 120 },
  auditMonths: { min: 1, max: 60 },
  inactiveMonths: { min: 3, max: 60 },
};

/** Résultat d'une purge : nombre de lignes supprimées. */
export interface PurgeSummary {
  inscriptions: number;
  surMesure: number;
  journal: number;
}

/**
 * Ouverture de la plateforme (paramétrage administrateur). Interne : un compte ne se
 * supprime que par un administrateur. Publique : chacun peut supprimer son compte depuis
 * « Mes données personnelles ».
 */
export interface PlatformSettings {
  publique: boolean;
}

export const DEFAULT_PLATFORM: PlatformSettings = { publique: false };
