import { Component, input } from '@angular/core';
import type { RequestEvent } from '@shared/requests';
import { formatDateTime } from '../catalog/dates';
import { LABELS } from '../labels';

/** Historique d'une demande : qui a fait quoi, quand, avec quel commentaire. */
@Component({
  selector: 'app-request-history',
  template: `
    <details class="history">
      <summary>{{ labels.history }}</summary>
      <ol>
        @for (e of events(); track $index) {
          <li>
            <span class="hint">{{ when(e.date) }}</span>
            {{ statusLabels()[e.statut] ?? e.statut }} {{ labels.by(e.par) }}
            @if (e.commentaire) {
              <q>{{ e.commentaire }}</q>
            }
          </li>
        }
      </ol>
    </details>
  `,
  styles: `
    .history ol {
      margin: var(--space-1) 0 0;
      padding-left: var(--space-3);
    }
    .history li {
      margin-bottom: var(--space-1);
    }
    .hint {
      display: block;
      font-size: 0.875rem;
      color: var(--color-text-muted);
    }
  `,
})
export class RequestHistory {
  readonly events = input.required<RequestEvent[]>();
  readonly statusLabels = input<Record<string, string>>(LABELS.requests.status);
  protected readonly labels = LABELS.requests;
  protected readonly when = formatDateTime;
}
