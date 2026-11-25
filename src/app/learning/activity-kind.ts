import { Component, computed, input } from '@angular/core';

/**
 * Famille d'une activité, pour distinguer d'un coup d'œil ce qu'on lit de ce à quoi on répond :
 * cours (leçon, diaporama, fiches), exercice (remise en ordre, association, mise en situation,
 * travaux pratiques) et quiz, qui valide le module.
 */
export type ActivityKind = 'cours' | 'exercice' | 'quiz';

const COURSE_TYPES = new Set(['lecon', 'diaporama', 'fiches']);

export function activityKind(type: string): ActivityKind {
  if (type === 'quiz') return 'quiz';
  return COURSE_TYPES.has(type) ? 'cours' : 'exercice';
}

/** Tracés des icônes (24 × 24, trait seul) : livre ouvert, crayon, feuille cochée. */
const PATHS: Record<ActivityKind, string[]> = {
  cours: [
    'M3 5.5c3-1.3 6-1.1 9 1 3-2.1 6-2.3 9-1v13c-3-1.3-6-1.1-9 1-3-2.1-6-2.3-9-1z',
    'M12 6.5v13',
  ],
  exercice: ['M4 20l1.2-4.4L15.8 5a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.4 18.8z', 'M14 7l3 3'],
  quiz: ['M8 4h8v3H8z', 'M8 5.5H5.5V21h13V5.5H16', 'M8.5 13.5l2.5 2.5 4.5-4.5'],
};

/** Petite icône décorative de la famille d'une activité ; le texte voisin porte le sens. */
@Component({
  selector: 'app-activity-icon',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      @for (d of paths(); track d) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      width: 1em;
      height: 1em;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class ActivityIcon {
  readonly kind = input.required<ActivityKind>();
  protected readonly paths = computed(() => PATHS[this.kind()]);
}
