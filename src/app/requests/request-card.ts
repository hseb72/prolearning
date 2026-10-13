import { Component, computed, input } from '@angular/core';
import type { CustomRequestView, RegistrationRequestView } from '@shared/requests';
import { formatDate } from '../catalog/dates';
import { LABELS } from '../labels';
import { RequestSteps, StatusPill } from '../ui/status';
import { RequestHistory } from './history';

export type AnyRequest =
  | { kind: 'inscription'; request: RegistrationRequestView }
  | { kind: 'surMesure'; request: CustomRequestView };

/**
 * Carte d'une demande (SPEC-UI, capture 06) : type et date en sur-titre, titre, statut à
 * droite, détails en liste de définitions, fil d'étapes, historique, puis les actions en
 * contenu.
 */
@Component({
  selector: 'app-request-card',
  imports: [RequestHistory, RequestSteps, StatusPill],
  host: { class: 'card request', '[attr.data-statut]': 'item().request.statut' },
  template: `
    <div class="req">
      <div>
        <p class="eyebrow muted">{{ eyebrow() }}</p>
        <h3>{{ title() }}</h3>
      </div>
      <span><app-status [status]="item().request.statut" /></span>
    </div>
    <dl>
      @for (row of rows(); track row[0]) {
        <dt>{{ row[0] }}</dt>
        <dd>{{ row[1] || labels.none }}</dd>
      }
    </dl>
    <app-request-steps [status]="item().request.statut" [kind]="item().kind" />
    <app-request-history
      [events]="item().request.historique"
      [statusLabels]="item().kind === 'inscription' ? labels.status : labels.customStatus"
    />
    <ng-content />
  `,
  styles: `
    :host {
      display: grid;
      gap: 10px;
    }
    h3 {
      margin: 2px 0 0;
    }
    .eyebrow.muted {
      color: var(--muted);
    }
    .req > span {
      line-height: 1;
    }
    dl {
      margin: 12px 0 0;
    }
  `,
})
export class RequestCard {
  readonly item = input.required<AnyRequest>();
  /** Affiche le demandeur (vue du manager). */
  readonly showRequester = input(false);
  protected readonly labels = LABELS.requests;

  protected readonly eyebrow = computed(() => {
    const i = this.item();
    return `${this.labels.kinds[i.kind]} · ${formatDate(i.request.createdAt)}`;
  });

  protected readonly title = computed(() => {
    const i = this.item();
    return i.kind === 'inscription' ? i.request.session.courseTitre : i.request.sujet;
  });

  protected readonly rows = computed((): [string, string][] => {
    const i = this.item();
    const dt = this.labels.dt;
    const requester: [string, string][] = this.showRequester()
      ? [[this.labels.requester, i.request.demandeur.displayName]]
      : [];
    if (i.kind === 'inscription') {
      const s = i.request.session;
      return [
        ...requester,
        [
          dt.session,
          [formatDate(s.debut), this.labels.modalites[s.modalite], s.lieu]
            .filter(Boolean)
            .join(' · '),
        ],
        [dt.places, this.labels.seats(s.placesRestantes, s.places)],
        [dt.message, i.request.motif],
      ];
    }
    const c = i.request;
    return [
      ...requester,
      [dt.formation, c.courseTitre ?? ''],
      [dt.participants, String(c.participants)],
      [dt.modalite, this.labels.modalites[c.modalite] ?? ''],
      [dt.periode, c.periode],
      [dt.details, c.details],
    ];
  });
}
