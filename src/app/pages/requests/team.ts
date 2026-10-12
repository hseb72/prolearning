import { httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import type { RegistrationRequestView, TeamRequests } from '@shared/requests';
import { AuthService } from '../../core/auth';
import { apiMessage, RequestsService } from '../../core/requests';
import { LABELS } from '../../labels';
import { DecisionForm } from '../../requests/decision';
import { RequestCard } from '../../requests/request-card';
import { EmptyState } from '../../ui/empty';
import { Stat } from '../../ui/stat';
import { ToastService } from '../../ui/toast';

/** Manager : validation des demandes d'inscription de son équipe. */
@Component({
  selector: 'app-team-requests',
  imports: [DecisionForm, EmptyState, RequestCard, Stat],
  template: `
    <p class="eyebrow">{{ labels.teamEyebrow }}</p>
    <h1>{{ labels.teamTitle }}</h1>
    <p class="lead">{{ labels.teamIntro }}</p>

    @if (data.isLoading() && !data.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (data.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else if (data.value(); as d) {
      <div class="stats">
        <app-stat [value]="d.aValider.length" [label]="labels.toValidate" />
        <app-stat [value]="d.recentes.length" [label]="labels.recent" />
      </div>
      <section aria-labelledby="validate-heading">
        <h2 id="validate-heading">{{ labels.toValidate }}</h2>
        @if (!d.aValider.length) {
          <app-empty class="card">{{ labels.nothingToValidate }}</app-empty>
        }
        <div class="list">
          @for (r of d.aValider; track r.id) {
            <app-request-card [item]="{ kind: 'inscription', request: r }" [showRequester]="true">
              <app-decision
                [acceptText]="labels.validate"
                [acceptLabel]="labels.validateLabel(r.demandeur.displayName, r.session.courseTitre)"
                [refuseLabel]="labels.refuseLabel(r.demandeur.displayName, r.session.courseTitre)"
                [busy]="busy()"
                (decided)="decide(r, $event)"
              />
            </app-request-card>
          }
        </div>
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading">{{ labels.recent }}</h2>
        @if (!d.recentes.length) {
          <app-empty class="card">{{ labels.noRecent }}</app-empty>
        }
        <div class="list">
          @for (r of d.recentes; track r.id) {
            <app-request-card [item]="{ kind: 'inscription', request: r }" [showRequester]="true" />
          }
        </div>
      </section>
    }
  `,
  styles: `
    section + section {
      margin-top: 28px;
    }
  `,
})
export class TeamRequestsPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RequestsService);
  protected readonly labels = LABELS.requests;
  protected readonly busy = signal(false);
  private readonly toast = inject(ToastService);

  protected readonly data = httpResource<TeamRequests>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/demandes/equipe', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

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
      this.toast.show(d.accept ? this.labels.validated(name) : this.labels.refused(name));
      this.data.reload();
    } catch (error) {
      this.toast.show(apiMessage(error, this.labels.failed));
    } finally {
      this.busy.set(false);
    }
  }
}
