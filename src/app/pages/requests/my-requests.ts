import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CustomRequestView, MyRequests, RegistrationRequestView } from '@shared/requests';
import { formatRange } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { apiMessage, RequestsService } from '../../core/requests';
import { LABELS } from '../../labels';
import { RequestHistory } from '../../requests/history';

/** « Mes demandes » : inscriptions et, pour les managers, sessions sur mesure. */
@Component({
  selector: 'app-my-requests',
  imports: [RouterLink, RequestHistory],
  template: `
    <h1>{{ labels.mineTitle }}</h1>
    <p>{{ labels.mineIntro }}</p>
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
      <section aria-labelledby="registrations-heading">
        <h2 id="registrations-heading">{{ labels.registrations }}</h2>
        @if (!d.inscriptions.length) {
          <p>
            {{ labels.noRegistration }}
            <a routerLink="/catalogue">{{ nav.catalog }}</a>
          </p>
        }
        <ul class="session-list">
          @for (r of d.inscriptions; track r.id) {
            <li class="session request" [attr.data-statut]="r.statut">
              <h3>
                <a [routerLink]="['/catalogue', r.session.courseId]">{{ r.session.courseTitre }}</a>
              </h3>
              <p class="session-when">{{ range(r) }}</p>
              <p>
                {{ labels.modalites[r.session.modalite] }}
                @if (r.session.lieu) {
                  · {{ r.session.lieu }}
                }
              </p>
              <p class="status-line">
                <strong>{{ labels.status[r.statut] }}</strong>
              </p>
              <app-request-history [events]="r.historique" />
              @if (cancellable(r)) {
                <div class="actions">
                  <button
                    class="button"
                    type="button"
                    [disabled]="busy()"
                    [attr.aria-label]="
                      r.statut === 'confirmee'
                        ? labels.unregisterLabel(r.session.courseTitre)
                        : labels.withdrawLabel(r.session.courseTitre)
                    "
                    (click)="cancel(r)"
                  >
                    {{ r.statut === 'confirmee' ? labels.unregister : labels.withdraw }}
                  </button>
                </div>
              }
            </li>
          }
        </ul>
      </section>

      @if (isManager() || d.surMesure.length) {
        <section aria-labelledby="custom-heading">
          <div class="page-heading">
            <h2 id="custom-heading">{{ labels.customHeading }}</h2>
            @if (isManager()) {
              <a class="button" routerLink="/demandes/sur-mesure">{{ labels.newCustom }}</a>
            }
          </div>
          @if (!d.surMesure.length) {
            <p>{{ labels.noCustom }}</p>
          }
          <ul class="session-list">
            @for (c of d.surMesure; track c.id) {
              <li class="session request" [attr.data-statut]="c.statut">
                <h3>{{ c.sujet }}</h3>
                <p>
                  {{ labels.modalites[c.modalite] }} · {{ labels.participants(c.participants) }}
                  @if (c.periode) {
                    · {{ c.periode }}
                  }
                </p>
                @if (c.courseTitre) {
                  <p>{{ labels.course }} : {{ c.courseTitre }}</p>
                }
                <p class="status-line">
                  <strong>{{ labels.customStatus[c.statut] }}</strong>
                </p>
                <app-request-history [events]="c.historique" [statusLabels]="labels.customStatus" />
                @if (c.statut === 'a_traiter' || c.statut === 'en_cours') {
                  <div class="actions">
                    <button
                      class="button"
                      type="button"
                      [disabled]="busy()"
                      [attr.aria-label]="labels.withdrawLabel(c.sujet)"
                      (click)="cancelCustom(c)"
                    >
                      {{ labels.withdraw }}
                    </button>
                  </div>
                }
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styleUrls: ['../catalog/catalog.scss', './requests.scss'],
})
export class MyRequestsPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RequestsService);
  protected readonly labels = LABELS.requests;
  protected readonly nav = LABELS.nav;
  protected readonly isManager = computed(() => this.auth.hasRole('manager'));
  protected readonly busy = signal(false);
  // Message laissé par la page précédente (demande sur mesure envoyée).
  protected readonly notice = signal<{ ok: boolean; text: string } | null>(
    typeof history.state?.notice === 'string' ? { ok: true, text: history.state.notice } : null,
  );

  protected readonly data = httpResource<MyRequests>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/demandes', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  protected range(r: RegistrationRequestView): string {
    return formatRange(r.session.debut, r.session.fin);
  }

  protected cancellable(r: RegistrationRequestView): boolean {
    if (r.statut === 'confirmee') return new Date(r.session.debut) > new Date();
    return r.statut === 'attente_manager' || r.statut === 'attente_formation';
  }

  protected async cancel(r: RegistrationRequestView): Promise<void> {
    const question =
      r.statut === 'confirmee' ? this.labels.confirmUnregister : this.labels.confirmWithdraw;
    if (!confirm(question)) return;
    await this.run(() => this.service.cancelRegistration(r.id));
  }

  protected async cancelCustom(c: CustomRequestView): Promise<void> {
    if (!confirm(this.labels.confirmWithdraw)) return;
    await this.run(() => this.service.cancelCustom(c.id));
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      this.notice.set({ ok: true, text: this.labels.withdrawn });
      this.data.reload();
    } catch (error) {
      this.notice.set({ ok: false, text: apiMessage(error, this.labels.failed) });
    } finally {
      this.busy.set(false);
    }
  }
}
