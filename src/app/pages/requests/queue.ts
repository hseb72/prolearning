import { httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  CustomProcessing,
  CustomRequestView,
  RegistrationRequestView,
  TrainingQueue,
} from '@shared/requests';
import { formatRange } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { apiMessage, RequestsService } from '../../core/requests';
import { AdminNav } from '../../layout/admin-nav';
import { LABELS } from '../../labels';
import { DecisionForm } from '../../requests/decision';
import { RequestHistory } from '../../requests/history';

/** Équipe formation : confirmation des inscriptions et traitement des demandes sur mesure. */
@Component({
  selector: 'app-request-queue',
  imports: [RouterLink, DecisionForm, RequestHistory, AdminNav],
  template: `
    <app-admin-nav />
    <h1>{{ labels.queueTitle }}</h1>
    <p>{{ labels.queueIntro }}</p>
    <div aria-live="polite">
      @if (notice(); as n) {
        <p class="message" [class.success]="n.ok" [class.error]="!n.ok" role="status">
          {{ n.text }}
        </p>
      }
    </div>

    @if (data.isLoading() && !data.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (data.error()) {
      <p class="message error" role="alert">{{ labels.loadFailed }}</p>
    } @else if (data.value(); as d) {
      <section aria-labelledby="confirm-heading">
        <h2 id="confirm-heading">{{ labels.toConfirm }}</h2>
        @if (!d.inscriptions.length) {
          <p>{{ labels.nothingToConfirm }}</p>
        }
        <ul class="session-list">
          @for (r of d.inscriptions; track r.id) {
            <li class="session request" [attr.data-statut]="r.statut">
              <h3>{{ r.demandeur.displayName }}</h3>
              <p>
                <a [routerLink]="['/catalogue', r.session.courseId]">{{ r.session.courseTitre }}</a>
              </p>
              <p class="session-when">{{ range(r) }}</p>
              <p [class.full]="r.session.placesRestantes === 0">
                {{ labels.modalites[r.session.modalite] }} ·
                {{ labels.seats(r.session.placesRestantes, r.session.places) }}
              </p>
              <app-request-history [events]="r.historique" />
              <app-decision
                [acceptText]="labels.confirm"
                [acceptLabel]="labels.confirmLabel(r.demandeur.displayName, r.session.courseTitre)"
                [refuseLabel]="
                  labels.refuseRegistrationLabel(r.demandeur.displayName, r.session.courseTitre)
                "
                [busy]="busy()"
                (decided)="decide(r, $event)"
              />
            </li>
          }
        </ul>
      </section>

      <section aria-labelledby="custom-queue-heading">
        <h2 id="custom-queue-heading">{{ labels.customQueue }}</h2>
        @if (!d.surMesure.length) {
          <p>{{ labels.noCustomQueue }}</p>
        }
        <ul class="session-list">
          @for (c of d.surMesure; track c.id) {
            <li class="session request" [attr.data-statut]="c.statut">
              <h3>{{ c.sujet }}</h3>
              <p>{{ labels.requester }} : {{ c.demandeur.displayName }}</p>
              <p>
                {{ labels.modalites[c.modalite] }} · {{ labels.participants(c.participants) }}
                @if (c.periode) {
                  · {{ labels.period }} : {{ c.periode }}
                }
              </p>
              @if (c.courseTitre) {
                <p>{{ labels.course }} : {{ c.courseTitre }}</p>
              }
              @if (c.details) {
                <blockquote>{{ c.details }}</blockquote>
              }
              <p class="status-line">
                <strong>{{ labels.customStatus[c.statut] }}</strong>
              </p>
              <app-request-history [events]="c.historique" [statusLabels]="labels.customStatus" />
              @if (c.statut === 'a_traiter' || c.statut === 'en_cours') {
                @if (c.statut === 'a_traiter') {
                  <div class="actions">
                    <button
                      class="button"
                      type="button"
                      [disabled]="busy()"
                      [attr.aria-label]="labels.customProgressLabel(c.sujet)"
                      (click)="process(c, { statut: 'en_cours' })"
                    >
                      {{ labels.markInProgress }}
                    </button>
                  </div>
                }
                <app-decision
                  [acceptText]="labels.accept"
                  [acceptLabel]="labels.customAcceptLabel(c.sujet)"
                  [refuseLabel]="labels.customRefuseLabel(c.sujet)"
                  [commentLabel]="labels.response"
                  [busy]="busy()"
                  (decided)="
                    process(c, {
                      statut: $event.accept ? 'acceptee' : 'refusee',
                      commentaire: $event.commentaire,
                    })
                  "
                />
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
  styleUrls: ['../catalog/catalog.scss', './requests.scss'],
})
export class RequestQueuePage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RequestsService);
  protected readonly labels = LABELS.requests;
  protected readonly busy = signal(false);
  protected readonly notice = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly data = httpResource<TrainingQueue>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/demandes/a-traiter', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

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
      this.notice.set({ ok: true, text: success });
      this.data.reload();
    } catch (error) {
      this.notice.set({ ok: false, text: apiMessage(error, this.labels.failed) });
    } finally {
      this.busy.set(false);
    }
  }
}
