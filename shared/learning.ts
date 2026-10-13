import type { BadgeId, LevelProgress } from './gamification.js';

/**
 * Ce que le lecteur de formation reçoit de l'API. Les réponses attendues (bonnes réponses
 * d'un quiz, ordre juste, paires, points d'un cas pratique) n'y figurent jamais : l'API
 * corrige, le navigateur n'a rien à deviner.
 */

export type ActivityType =
  'lecon' | 'diaporama' | 'quiz' | 'ordre' | 'association' | 'scenario' | 'fiches';

/** Référence telle que déclarée dans la formation (§ 7). */
export interface Reference {
  id: string;
  titre: string;
  source: string;
  url?: string;
  type: string;
  acces: 'libre' | 'inscription' | 'payant' | 'interne';
  langue: string;
  note?: string;
}

export interface GlossaryEntry {
  terme: string;
  definition: string;
}

export type Bloc =
  | { type: 'texte'; markdown: string }
  | { type: 'encadre'; variante: string; titre?: string; markdown: string }
  | { type: 'approfondir'; titre: string; markdown: string; references?: string[] }
  | { type: 'image'; fichier?: string; url?: string; alt: string; legende?: string }
  | { type: 'video'; url: string; titre: string; transcription?: string }
  | { type: 'references'; ids: string[] };

interface ActivityBase {
  id: string;
  titre: string;
  obligatoire: boolean;
  dureeEstimeeMinutes?: number;
}

export type LearnerActivity =
  | (ActivityBase & { type: 'lecon'; blocs: Bloc[] })
  | (ActivityBase & {
      type: 'diaporama';
      diapos: {
        image: string;
        alt: string;
        titre?: string;
        explication: string;
        approfondir?: { titre: string; markdown: string; references?: string[] };
      }[];
    })
  | (ActivityBase & { type: 'quiz'; questionsParTentative: number; seuil: number })
  | (ActivityBase & { type: 'ordre'; consigne: string; elements: { cle: string; texte: string }[] })
  | (ActivityBase & {
      type: 'association';
      consigne: string;
      gauches: { cle: string; texte: string }[];
      droites: string[];
    })
  | (ActivityBase & { type: 'scenario'; contexte: string })
  | (ActivityBase & { type: 'fiches'; cartes: { recto: string; verso: string }[] })
  | (ActivityBase & {
      type: 'pratique';
      objectif: string;
      environnement?: string;
      fichiers: PracticeFile[];
      etapes: { titre: string; markdown: string; resultat?: string }[];
      verification: { id: string; texte: string }[];
      solution?: { titre: string; markdown: string; references?: string[] };
      nettoyage?: string;
      references: string[];
    });

/** Fichier fourni par des travaux pratiques : chemin relatif (au plus trois sous-dossiers). */
export interface PracticeFile {
  nom: string;
  langage?: 'yaml' | 'json' | 'bash' | 'dockerfile' | 'texte';
  description?: string;
  contenu: string;
}

export interface LearnerModule {
  id: string;
  titre: string;
  resume: string;
  objectifs: string[];
  dureeEstimeeMinutes: number;
  activites: LearnerActivity[];
}

export interface LearnerFormation {
  id: string;
  version: string;
  titre: string;
  sousTitre?: string;
  theme: string;
  resume: string;
  public: string;
  prerequis: string;
  objectifs: string[];
  dureeEstimeeMinutes: number;
  niveau?: string;
  droits: string;
  deblocage: 'sequentiel' | 'libre';
  references: Reference[];
  glossaire: GlossaryEntry[];
  modules: LearnerModule[];
}

export type ActivityStatus = 'a-faire' | 'faite' | 'reussie' | 'echouee';

export interface ActivityState {
  statut: ActivityStatus;
  points: number;
  /** Quiz : meilleure part de bonnes réponses ; cas pratique : meilleur nombre d'étoiles. */
  score: number | null;
}

export interface ModuleState {
  debloque: boolean;
  termine: boolean;
}

/** Progression de l'apprenant dans une formation, par `module.id` + `activite.id`. */
export interface FormationProgress {
  activites: Record<string, Record<string, ActivityState>>;
  modules: Record<string, ModuleState>;
  points: number;
  terminee: boolean;
}

export interface LearnerFormationResponse {
  formation: LearnerFormation;
  progression: FormationProgress;
}

export interface FormationCard {
  id: string;
  titre: string;
  sousTitre?: string;
  theme: string;
  resume: string;
  dureeEstimeeMinutes: number;
  niveau?: string;
  modulesTotal: number;
  modulesTermines: number;
  points: number;
}

/** Points, niveau et badges de l'apprenant, tous parcours confondus (dans l'espace actif). */
export interface LearnerProfile {
  points: number;
  niveau: LevelProgress;
  badges: BadgeId[];
}

// ── Échanges des exercices ───────────────────────────────────────────────────

export interface QuizAttempt {
  tentative: number;
  questions: {
    id: string;
    type: 'choix_unique' | 'choix_multiple' | 'vrai_faux';
    enonce: string;
    indice?: string;
    options: { id: string; texte: string }[];
  }[];
}

export interface QuizAnswers {
  tentative: number;
  reponses: Record<string, string[]>;
}

export interface QuizCorrection {
  bonnesReponses: number;
  total: number;
  seuil: number;
  reussi: boolean;
  questions: {
    id: string;
    juste: boolean;
    bonnes: string[];
    explication: string;
    references: string[];
  }[];
  etat: ActivityState;
  moduleTermine: boolean;
}

export interface ExerciseCorrection {
  juste: boolean;
  explication: string;
  /** Ordre : clés dans le bon ordre. Association : la bonne droite de chaque gauche. */
  solution: string[] | Record<string, string>;
  etat: ActivityState;
  moduleTermine: boolean;
}

export interface ScenarioStep {
  /** Retour du dernier choix, s'il y en a un. */
  retour?: string;
  /** Nœud courant ; absent à la fin. */
  noeud?: { texte: string; choix: string[] };
  fin?: {
    points: number;
    etoiles: number;
    message: string;
    etat: ActivityState;
    moduleTermine: boolean;
  };
}

export interface CompletionResult {
  etat: ActivityState;
  moduleTermine: boolean;
}

// ── Publication des réussites (décision 5) ───────────────────────────────────

/** Qui voit la réussite d'un parcours : l'apprenant seul (défaut), son manager, ou tous. */
export const SHARE_VISIBILITIES = ['prive', 'manager', 'communaute'] as const;
export type ShareVisibility = (typeof SHARE_VISIBILITIES)[number];

/** Réussite publiée : un parcours, la progression de l'apprenant, son niveau et ses badges. */
export interface SharedAchievement {
  personne: string;
  formationId: string;
  formationTitre: string;
  modulesTermines: number;
  modulesTotal: number;
  termine: boolean;
  niveau: string;
  badges: BadgeId[];
  visibilite: Exclude<ShareVisibility, 'prive'>;
  publieLe: string;
}
