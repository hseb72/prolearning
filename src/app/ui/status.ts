import { Component, computed, input } from '@angular/core';
import type { CustomStatus, RegistrationStatus } from '@shared/requests';
import { LABELS } from '../labels';

/** Statut d'une demande, inscription ou session sur mesure. */
export type RequestStatus = RegistrationStatus | CustomStatus;

/** Les cinq statuts affichés du prototype (décision C : la validation manager est gardée). */
export type StatusKey = keyof typeof LABELS.ui.status;

const DISPLAY: Record<RequestStatus, StatusKey> = {
  attente_manager: 'envoyee',
  a_traiter: 'envoyee',
  attente_formation: 'en_cours',
  en_cours: 'en_cours',
  confirmee: 'acceptee',
  acceptee: 'acceptee',
  refusee: 'refusee',
  annulee: 'annulee',
};

export function statusKey(status: RequestStatus): StatusKey {
  return DISPLAY[status];
}

/** Rang de l'étape atteinte (0, 1, 2) ; -1 pour une demande annulée. */
export function stepIndex(status: RequestStatus): number {
  switch (status) {
    case 'attente_manager':
    case 'a_traiter':
      return 0;
    case 'attente_formation':
    case 'en_cours':
      return 1;
    case 'annulee':
      return -1;
    default:
      return 2;
  }
}

/** Pastille de statut (`.status`, SPEC-UI § 4). */
@Component({
  selector: 'app-status',
  host: { '[class]': '"status st-" + key()' },
  template: `{{ label() }}`,
})
export class StatusPill {
  readonly status = input.required<RequestStatus>();
  protected readonly key = computed(() => statusKey(this.status()));
  protected readonly label = computed(() => LABELS.ui.status[this.key()]);
}

/** Fil d'étapes d'une demande (`.steps`) : « Envoyée · Validation manager · Décision ». */
@Component({
  selector: 'app-request-steps',
  host: { class: 'steps', role: 'list', '[attr.aria-label]': 'labels.label' },
  template: `
    @for (step of steps(); track step; let i = $index) {
      <span role="listitem" [class.on]="i <= reached()"
        >{{ step }}
        @if (i <= reached()) {
          <span class="visually-hidden">({{ labels.reached }})</span>
        }
      </span>
    }
  `,
})
export class RequestSteps {
  readonly status = input.required<RequestStatus>();
  readonly kind = input<'inscription' | 'surMesure'>('inscription');
  protected readonly labels = LABELS.ui.steps;
  protected readonly steps = computed(() => this.labels[this.kind()]);
  protected readonly reached = computed(() => stepIndex(this.status()));
}
