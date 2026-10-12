import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import type {
  CustomProcessing,
  CustomRequestView,
  RegistrationRequestView,
  TrainingQueue,
} from '@shared/requests';
import { formatDate, formatRange } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { apiMessage, RequestsService } from '../../core/requests';
import { AdminNav } from '../../layout/admin-nav';
import { LABELS } from '../../labels';
import { DecisionForm } from '../../requests/decision';
import { RequestHistory } from '../../requests/history';
import { EmptyState } from '../../ui/empty';
import { Stat } from '../../ui/stat';
import { StatusPill } from '../../ui/status';
import { ToastService } from '../../ui/toast';

/** Équipe formation : confirmation des inscriptions et traitement des demandes sur mesure. */
@Component({
  selector: 'app-request-queue',
  imports: [AdminNav, DecisionForm, EmptyState, RequestHistory, Stat, StatusPill],
  template: `
    <app-admin-nav />
    <p class="eyebrow">{{ labels.adminEyebrow(spaceName()) }}</p>
    <h1>{{ labels.queueTitle }}</h1>
    <p class="lead">{{ labels.queueIntro }}</p>

    @if (data.isLoading() && !data.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (data.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else if (data.value(); as d) {
      <div class="stats">
        <app-stat [value]="stats().todo" [label]="labels.queueStats.todo" />
        <app-stat [value]="stats().doing" [label]="labels.queueStats.doing" />
        <app-stat [value]="stats().accepted" [label]="labels.queueStats.accepted" />
        <app-stat [value]="stats().refused" [label]="labels.queueStats.refused" />
      </div>
      @if (!d.inscriptions.length && !d.surMesure.length) {
        <app-empty class="card">{{ labels.queueEmpty }}</app-empty>
      } @else {
        <div class="card bo-wrap">
          <table class="bo">
            <caption class="visually-hidden">
              {{
                labels.queueTable.caption
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ labels.queueTable.request }}</th>
                <th scope="col">{{ labels.queueTable.requester }}</th>
                <th scope="col">{{ labels.queueTable.details }}</th>
                <th scope="col">{{ labels.queueTable.status }}</th>
                <th scope="col">{{ labels.queueTable.actions }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of d.surMesure; track c.id) {
                <tr class="request" [attr.data-statut]="c.statut">
                  <th scope="row">
                    <b>{{ c.sujet }}</b
                    ><br />
                    <span class="small muted">{{ kinds.surMesure }} · {{ day(c.createdAt) }}</span>
                  </th>
                  <td>{{ c.demandeur.displayName }}</td>
                  <td class="small">
                    @if (c.courseTitre) {
                      {{ dt.formation }} : {{ c.courseTitre }}<br />
                    }
                    {{ dt.participants }} : {{ c.participants }}<br />
                    {{ dt.modalite }} : {{ labels.modalites[c.modalite] }}
                    @if (c.periode) {
                      <br />{{ dt.periode }} : {{ c.periode }}
                    }
                    @if (c.details) {
                      <br />« {{ c.details }} »
                    }
                    <app-request-history
                      [events]="c.historique"
                      [statusLabels]="labels.customStatus"
                    />
                  </td>
                  <td><app-status [status]="c.statut" /></td>
                  <td class="acts-cell">
                    @if (c.statut === 'a_traiter' || c.statut === 'en_cours') {
                      <app-decision
                        [acceptText]="labels.accept"
                        [acceptLabel]="labels.customAcceptLabel(c.sujet)"
                        [refuseLabel]="labels.customRefuseLabel(c.sujet)"
                        [commentLabel]="labels.response"
                        [extraText]="c.statut === 'a_traiter' ? labels.markInProgress : ''"
                        [extraLabel]="labels.customProgressLabel(c.sujet)"
                        [busy]="busy()"
                        (extra)="process(c, { statut: 'en_cours', commentaire: $event })"
                        (decided)="
                          process(c, {
                            statut: $event.accept ? 'acceptee' : 'refusee',
                            commentaire: $event.commentaire,
                          })
                        "
                      />
                    }
                  </td>
                </tr>
              }
              @for (r of d.inscriptions; track r.id) {
                <tr class="request" [attr.data-statut]="r.statut">
                  <th scope="row">
                    <b>{{ r.session.courseTitre }}</b
                    ><br />
                    <span class="small muted"
                      >{{ kinds.inscription }} · {{ day(r.createdAt) }}</span
                    >
                  </th>
                  <td>{{ r.demandeur.displayName }}</td>
                  <td class="small">
                    {{ dt.session }} : {{ range(r) }} · {{ labels.modalites[r.session.modalite] }}
                    @if (r.session.lieu) {
                      · {{ r.session.lieu }}
                    }
                    <br />{{ labels.seats(r.session.placesRestantes, r.session.places) }}
                    @if (r.motif) {
                      <br />« {{ r.motif }} »
                    }
                    <app-request-history [events]="r.historique" />
                  </td>
                  <td><app-status [status]="r.statut" /></td>
                  <td class="acts-cell">
                    <app-decision
                      [acceptText]="labels.confirm"
                      [acceptLabel]="
                        labels.confirmLabel(r.demandeur.displayName, r.session.courseTitre)
                      "
                      [refuseLabel]="
                        labels.refuseRegistrationLabel(
                          r.demandeur.displayName,
                          r.session.courseTitre
                        )
                      "
                      [commentLabel]="labels.response"
                      [busy]="busy()"
                      (decided)="decide(r, $event)"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
  styles: `
    th[scope='row'] {
      font-weight: 400;
      text-align: left;
      min-width: 180px;
    }
    .acts-cell {
      min-width: 240px;
    }
  `,
})
export class RequestQueuePage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RequestsService);
  protected readonly labels = LABELS.requests;
  protected readonly busy = signal(false);
  private readonly toast = inject(ToastService);
  protected readonly kinds = LABELS.requests.kinds;
  protected readonly dt = LABELS.requests.dt;
  protected readonly spaceName = computed(() =>
    this.auth.me()?.space === 'demo' ? LABELS.space.demoName : LABELS.space.productionName,
  );

  protected readonly data = httpResource<TrainingQueue>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/demandes/a-traiter', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  protected readonly stats = computed(() => {
    const d = this.data.value();
    const custom = d?.surMesure ?? [];
    const count = (statut: string) => custom.filter((c) => c.statut === statut).length;
    return {
      todo: (d?.inscriptions.length ?? 0) + count('a_traiter'),
      doing: count('en_cours'),
      accepted: count('acceptee'),
      refused: count('refusee'),
    };
  });

  protected day(iso: string): string {
    return formatDate(iso);
  }

  protected range(r: RegistrationRequestView): string {
    return formatRange(r.session.debut, r.session.fin);
  }

  protected decide(
    r: RegistrationRequestView,
    d: { accept: boolean; commentaire: string },
  ): Promise<void> {
    const name = r.demandeur.displayName;
    return this.run(
      () =>
        this.service.trainingDecision(r.id, {
          decision: d.accept ? 'accepter' : 'refuser',
          commentaire: d.commentaire,
        }),
      d.accept ? this.labels.confirmed(name) : this.labels.refused(name),
    );
  }

  protected process(c: CustomRequestView, input: CustomProcessing): Promise<void> {
    return this.run(() => this.service.processCustom(c.id, input), this.labels.processed);
  }

  private async run(action: () => Promise<unknown>, success: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      this.toast.show(success);
      this.data.reload();
    } catch (error) {
      this.toast.show(apiMessage(error, this.labels.failed));
    } finally {
      this.busy.set(false);
    }
  }
}
