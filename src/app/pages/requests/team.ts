import { httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RegistrationRequestView, TeamRequests } from '@shared/requests';
import { formatRange } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { apiMessage, RequestsService } from '../../core/requests';
import { LABELS } from '../../labels';
import { DecisionForm } from '../../requests/decision';
import { RequestHistory } from '../../requests/history';

/** Manager : validation des demandes d'inscription de son équipe. */
@Component({
  selector: 'app-team-requests',
  imports: [RouterLink, DecisionForm, RequestHistory],
  template: `
    <h1>{{ labels.teamTitle }}</h1>
    <p>{{ labels.teamIntro }}</p>
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
      <section aria-labelledby="validate-heading">
        <h2 id="validate-heading">{{ labels.toValidate }}</h2>
        @if (!d.aValider.length) {
          <p>{{ labels.nothingToValidate }}</p>
        }
        <ul class="session-list">
          @for (r of d.aValider; track r.id) {
            <li class="session request" [attr.data-statut]="r.statut">
              <h3>{{ r.demandeur.displayName }}</h3>
              <p>
                <a [routerLink]="['/catalogue', r.session.courseId]">{{ r.session.courseTitre }}</a>
              </p>
              <p class="session-when">{{ range(r) }}</p>
              <p>
                {{ labels.modalites[r.session.modalite] }} ·
                {{ labels.seats(r.session.placesRestantes, r.session.places) }}
              </p>
              @if (r.motif) {
                <p>{{ labels.motif }} :</p>
                <blockquote>{{ r.motif }}</blockquote>
              }
              <app-decision
                [acceptText]="labels.validate"
                [acceptLabel]="labels.validateLabel(r.demandeur.displayName, r.session.courseTitre)"
                [refuseLabel]="labels.refuseLabel(r.demandeur.displayName, r.session.courseTitre)"
                [busy]="busy()"
                (decided)="decide(r, $event)"
              />
            </li>
          }
        </ul>
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading">{{ labels.recent }}</h2>
        @if (!d.recentes.length) {
          <p>{{ labels.noRecent }}</p>
        }
        <ul class="session-list">
          @for (r of d.recentes; track r.id) {
            <li class="session request" [attr.data-statut]="r.statut">
              <h3>{{ r.demandeur.displayName }}</h3>
              <p>{{ r.session.courseTitre }} · {{ range(r) }}</p>
              <p class="status-line">
                <strong>{{ labels.status[r.statut] }}</strong>
              </p>
              <app-request-history [events]="r.historique" />
            </li>
          }
        </ul>
      </section>
    }
  `,
  styleUrls: ['../catalog/catalog.scss', './requests.scss'],
})
export class TeamRequestsPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RequestsService);
  protected readonly labels = LABELS.requests;
  protected readonly busy = signal(false);
  protected readonly notice = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly data = httpResource<TeamRequests>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/demandes/equipe', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  protected range(r: RegistrationRequestView): string {
    return formatRange(r.session.debut, r.session.fin);
  }

  protected async decide(
    r: RegistrationRequestView,
    d: { accept: boolean; commentaire: string },
  ): Promise<void> {
    this.busy.set(true);
    try {
      await this.service.managerDecision(r.id, {
        decision: d.accept ? 'accepter' : 'refuser',
        commentaire: d.commentaire,
      });
      const name = r.demandeur.displayName;
      this.notice.set({
        ok: true,
        text: d.accept ? this.labels.validated(name) : this.labels.refused(name),
      });
      this.data.reload();
    } catch (error) {
      this.notice.set({ ok: false, text: apiMessage(error, this.labels.failed) });
    } finally {
      this.busy.set(false);
    }
  }
}
