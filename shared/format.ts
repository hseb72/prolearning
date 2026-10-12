/**
 * Format d'échange des formations 3S (docs/format/format-formation-3s.md) : ce que
 * l'interface et l'API se partagent. Le format est un contrat, on ne le change pas ici.
 */

/** Versions du format que la plateforme sait lire (§ 13). */
export const SUPPORTED_FORMAT_VERSIONS = ['1.0'] as const;

/** Taille maximale d'un fichier `.formation.json` (§ 1 : 10 Mo par fichier). */
export const MAX_FORMATION_BYTES = 10 * 1024 * 1024;

/** Un constat du rapport de validation, rattaché à l'élément concerné. */
export interface ReportItem {
  /** Chemin de l'élément, au style du § 11 : `modules[0].activites[3].questions[2]`. Vide = racine. */
  chemin: string;
  message: string;
}

/** Rapport de validation (schéma + contrôles métier), mêmes verdicts que tools/valider-formation.js. */
export interface ValidationReport {
  ok: boolean;
  erreurs: ReportItem[];
  avertissements: ReportItem[];
  /** Renseigné quand le fichier a pu être lu, même invalide. */
  formation?: { id: string; version: string; titre: string };
}

/** Résultat d'un import : le rapport, et ce qui a été enregistré s'il est valide. */
export interface ImportResult {
  rapport: ValidationReport;
  importee: boolean;
  /** Pourquoi une formation valide n'a pas été importée (règles de version, § 11). */
  refus?: string;
  action?: 'nouvelle' | 'nouvelle-version' | 'remplacement';
}

export interface FormationVersionRow {
  version: string;
  formatVersion: string;
  importedAt: string;
  importedBy: string | null;
  origine: 'import' | 'publication';
  /** Démonstration seulement : date de publication de cette version en production. */
  publishedAt: string | null;
}

export interface FormationRow {
  id: string;
  titre: string;
  theme: string;
  versionCourante: string;
  versions: FormationVersionRow[];
}

/** Résultat d'une publication démonstration → production. */
export interface PublishResult {
  publiee: boolean;
  refus?: string;
  action?: 'nouvelle' | 'nouvelle-version';
}
