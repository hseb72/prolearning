/**
 * Ludification (CLAUDE.md, « Formations en ligne » ; § 10 du format). Sobre : des points,
 * des niveaux et quelques badges communs, visibles de l'apprenant seul (décision 5).
 */

/** Points par défaut du § 10. Le champ `points` d'une activité les remplace. */
export const DEFAULT_POINTS = {
  lecon: 10,
  diaporama: 10,
  /** Par bonne réponse. */
  quiz: 10,
  ordre: 30,
  association: 20,
  /** Par étoile. */
  scenario: 20,
  fiches: 10,
  /** Travaux pratiques (format 1.1, § 6.8). */
  pratique: 30,
} as const;

/** Bonus par module terminé (§ 10). */
export const MODULE_BONUS = 50;

export interface Level {
  numero: number;
  nom: string;
  seuil: number;
}

export const LEVELS: readonly Level[] = [
  { numero: 1, nom: 'Découverte', seuil: 0 },
  { numero: 2, nom: 'Initié', seuil: 100 },
  { numero: 3, nom: 'Praticien', seuil: 300 },
  { numero: 4, nom: 'Confirmé', seuil: 600 },
  { numero: 5, nom: 'Expert', seuil: 1000 },
];

export interface LevelProgress {
  niveau: Level;
  /** Points restant à gagner pour le niveau suivant ; null au dernier niveau. */
  prochainSeuil: number | null;
}

export function levelFor(points: number): LevelProgress {
  let index = 0;
  while (index + 1 < LEVELS.length && points >= LEVELS[index + 1]!.seuil) index++;
  const next = LEVELS[index + 1];
  return { niveau: LEVELS[index]!, prochainSeuil: next ? next.seuil : null };
}

export const BADGES = {
  'premier-pas': { nom: 'Premier pas', description: 'Une première activité terminée.' },
  'module-termine': { nom: 'Module accompli', description: 'Un premier module terminé.' },
  'sans-faute': {
    nom: 'Sans faute',
    description: 'Un quiz réussi avec toutes les bonnes réponses.',
  },
  stratege: { nom: 'Stratège', description: 'Trois étoiles à un cas pratique.' },
  'parcours-termine': {
    nom: 'Parcours terminé',
    description: 'Tous les modules d’une formation terminés.',
  },
} as const;

export type BadgeId = keyof typeof BADGES;

/** Faits qui donnent les badges, calculés à partir des résultats de l'apprenant. */
export interface BadgeFacts {
  activitesTerminees: number;
  modulesTermines: number;
  quizParfaits: number;
  scenariosTroisEtoiles: number;
  formationsTerminees: number;
}

export function badgesFor(facts: BadgeFacts): BadgeId[] {
  const earned: BadgeId[] = [];
  if (facts.activitesTerminees > 0) earned.push('premier-pas');
  if (facts.modulesTermines > 0) earned.push('module-termine');
  if (facts.quizParfaits > 0) earned.push('sans-faute');
  if (facts.scenariosTroisEtoiles > 0) earned.push('stratege');
  if (facts.formationsTerminees > 0) earned.push('parcours-termine');
  return earned;
}
