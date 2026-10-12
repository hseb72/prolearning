import type { ActivityState, GlossaryEntry, LearnerActivity, Reference } from '@shared/learning';

/** Ce que chaque composant d'activité reçoit de la page. */
export interface ActivityContext {
  formationId: string;
  moduleId: string;
  activity: LearnerActivity;
  state: ActivityState;
  glossary: readonly GlossaryEntry[];
  references: readonly Reference[];
}

/** Ce qu'il renvoie quand l'API a enregistré un résultat. */
export interface ActivityProgress {
  etat: ActivityState;
  moduleTermine: boolean;
}

export type ActivityOf<T extends LearnerActivity['type']> = Extract<LearnerActivity, { type: T }>;
