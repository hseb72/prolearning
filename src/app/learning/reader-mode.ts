import { InjectionToken } from '@angular/core';

/**
 * Mode du lecteur : l'apprenant dans son espace (progression enregistrée), ou la relecture
 * d'une formation en évaluation par un administrateur (aperçu, rien n'est enregistré).
 * Les routes d'évaluation fournissent `PREVIEW_MODE` avec leur propre `LearningService`.
 */
export interface ReaderMode {
  /** Préfixe de l'API du lecteur. */
  api: string;
  /** Préfixe des adresses du lecteur dans le front. */
  route: string;
  preview: boolean;
}

export const LEARNER_MODE: ReaderMode = {
  api: '/api/parcours',
  route: '/parcours',
  preview: false,
};

export const PREVIEW_MODE: ReaderMode = {
  api: '/api/evaluation/parcours',
  route: '/administration/evaluation',
  preview: true,
};

export const READER_MODE = new InjectionToken<ReaderMode>('READER_MODE', {
  providedIn: 'root',
  factory: () => LEARNER_MODE,
});
