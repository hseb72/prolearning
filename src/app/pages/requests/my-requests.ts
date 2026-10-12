import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CustomRequestView, MyRequests, RegistrationRequestView } from '@shared/requests';
import { AuthService } from '../../core/auth';
import { apiMessage, RequestsService } from '../../core/requests';
import { LABELS } from '../../labels';
import { RequestCard, type AnyRequest } from '../../requests/request-card';
import { ConfirmService } from '../../ui/confirm';
import { EmptyState } from '../../ui/empty';
import { ToastService } from '../../ui/toast';

/** « Mes demandes » (SPEC-UI, capture 06) : inscriptions et sessions sur mesure. */
@Component({
  selector: 'app-my-requests',
  imports: [RouterLink, EmptyState, RequestCard],
  template: `
    <p class="eyebrow">{{ labels.mineEyebrow }}</p>
    <h1>{{ labels.mineHeading }}</h1>
    <p class="lead">{{ labels.mineLead }}</p>

    @if (data.isLoading() && !data.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (data.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else {
      @if (!items().length) {
        <app-empty class="card">
          {{ labels.emptyMine }}
          <a class="link" routerLink="/sessions">{{ labels.seeSessions }}</a>
        </app-empty>
      }
      <div class="list">
        @for (item of items(); track item.kind + item.request.id) {
          <app-request-card [item]="item">
            @if (item.kind === 'inscription') {
              @if (cancellable(item.request)) {
                <div>
                  <button
                    class="link"
                    type="button"
                    [disabled]="busy()"
                    [attr.aria-label]="
                      item.request.statut === 'confirmee'
                        ? labels.unregisterLabel(item.request.session.courseTitre)
                        : labels.withdrawLabel(item.request.session.courseTitre)
                    "
                    (click)="cancel(item.request)"
                  >
                    {{ item.request.statut === 'confirmee' ? labels.unregister : labels.withdraw }}
                  </button>
                </div>
              }
            } @else if (item.request.statut === 'a_traiter' || item.request.statut === 'en_cours') {
              <div>
                <button
                  class="link"
                  type="button"
                  [disabled]="busy()"
                  [attr.aria-label]="labels.withdrawLabel(item.request.sujet)"
                  (click)="cancelCustom(item.request)"
                >
                  {{ labels.withdraw }}
                </button>
              </div>
            }
          </app-request-card>
        }
      </div>
    }
  `,
})
export class MyRequestsPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RequestsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly labels = LABELS.requests;
  protected readonly busy = signal(false);

  protected readonly data = httpResource<MyRequests>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/demandes', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  /** Inscriptions et sessions sur mesure, de la plus récente à la plus ancienne. */
  protected readonly items = computed((): AnyRequest[] => {
    const d = this.data.value();
    if (!d) return [];
    return [
      ...d.inscriptions.map((request) => ({ kind: 'inscription' as const, request })),
      ...d.surMesure.map((request) => ({ kind: 'surMesure' as const, request })),
    ].sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt));
  });

  protected cancellable(r: RegistrationRequestView): boolean {
    if (r.statut === 'confirmee') return new Date(r.session.debut) > new Date();
    return r.statut === 'attente_manager' || r.statut === 'attente_formation';
  }

  protected async cancel(r: RegistrationRequestView): Promise<void> {
    const unregister = r.statut === 'confirmee';
    const ok = await this.confirm.ask({
      title: unregister ? this.labels.unregister : this.labels.confirmWithdraw,
      text: unregister ? this.labels.confirmUnregister : this.labels.withdrawInfo,
      confirm: unregister ? this.labels.unregister : this.labels.withdraw,
      cancel: this.labels.keep,
    });
    if (!ok) return;
    await this.run(
      () => this.service.cancelRegistration(r.id),
      unregister ? this.labels.unregistered : this.labels.withdrawn,
    );
  }

  protected async cancelCustom(c: CustomRequestView): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.labels.confirmWithdraw,
      text: this.labels.withdrawInfo,
      confirm: this.labels.withdraw,
      cancel: this.labels.keep,
    });
    if (!ok) return;
    await this.run(() => this.service.cancelCustom(c.id), this.labels.withdrawn);
  }

  private async run(action: () => Promise<unknown>, done: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      this.toast.show(done);
      this.data.reload();
    } catch (error) {
      this.toast.show(apiMessage(error, this.labels.failed));
    } finally {
      this.busy.set(false);
    }
  }
}
