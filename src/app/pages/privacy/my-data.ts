import { HttpClient, httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { PlatformSettings, RetentionSettings } from '@shared/privacy';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth';
import { apiMessage } from '../../core/requests';
import { LABELS } from '../../labels';
import { ConfirmService } from '../../ui/confirm';
import { ToastService } from '../../ui/toast';

/** « Mes données personnelles » : ce qui est gardé, combien de temps, export, effacement. */
@Component({
  selector: 'app-my-data',
  template: `
    <p class="eyebrow">{{ labels.footerLink }}</p>
    <h1>{{ labels.title }}</h1>
    <p class="lead">{{ labels.intro }}</p>

    <section class="card block" aria-labelledby="kept-title">
      <h2 id="kept-title">{{ labels.kept }}</h2>
      <ul>
        @for (item of labels.keptItems; track item) {
          <li>{{ item }}</li>
        }
      </ul>
      <p>{{ labels.visibility }}</p>
    </section>

    <section class="card block" aria-labelledby="durations-title">
      <h2 id="durations-title">{{ labels.durations }}</h2>
      @if (retention.value(); as r) {
        <ul>
          <li>{{ labels.requests(r.requestsMonths) }}</li>
          <li>{{ labels.audit(r.auditMonths) }}</li>
          <li>{{ labels.progress }}</li>
          <li>{{ labels.dormant(r.inactiveMonths) }}</li>
        </ul>
      } @else if (retention.error()) {
        <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
      } @else {
        <p role="status">{{ labels.loading }}</p>
      }
    </section>

    <section class="card block" aria-labelledby="export-title">
      <h2 id="export-title">{{ labels.exportTitle }}</h2>
      <p>{{ labels.exportText }}</p>
      <a class="btn" href="/api/moi/donnees" download>{{ labels.exportButton }}</a>
    </section>

    <section class="card block" aria-labelledby="delete-title">
      <h2 id="delete-title">{{ labels.deleteTitle }}</h2>
      <!-- Plateforme publique : chacun supprime son compte ; interne : un administrateur. -->
      @if (platform.value()?.publique) {
        <p>{{ labels.deleteSelfText }}</p>
        <button class="btn danger" type="button" [disabled]="busy()" (click)="deleteAccount()">
          {{ labels.deleteSelfButton }}
        </button>
      } @else if (platform.hasValue()) {
        <p>{{ labels.deleteText }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
      max-width: 760px;
    }
    .eyebrow,
    h1,
    .lead {
      margin-bottom: 0;
    }
    .block {
      display: grid;
      gap: 10px;
    }
    h2 {
      font-size: 20px;
      margin: 0;
    }
    ul,
    p {
      margin: 0;
    }
    .btn {
      justify-self: start;
    }
  `,
})
export class MyDataPage {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly platform = httpResource<PlatformSettings>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/parametres/plateforme', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  protected async deleteAccount(): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.labels.deleteSelfConfirmTitle,
      text: this.labels.deleteSelfConfirmText,
      confirm: this.labels.deleteSelfConfirm,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.http.delete<{ deconnecte: boolean }>('/api/moi'));
      this.toast.show(this.labels.deletedSelf);
      if (res.deconnecte) {
        // Fermer aussi la session Keycloak, sinon la reconnexion recréerait le compte aussitôt.
        const redirect = await this.auth.logout();
        if (redirect.startsWith('/')) await this.router.navigateByUrl(redirect);
        else window.location.href = redirect;
      } else {
        // Démonstration : le compte joué a disparu, l'administrateur reprend le compte par défaut.
        await this.auth.load(true);
        await this.router.navigateByUrl('/catalogue');
      }
    } catch (error) {
      this.toast.show(apiMessage(error, this.labels.deleteSelfFailed));
    } finally {
      this.busy.set(false);
    }
  }
  protected readonly labels = LABELS.privacy;
  protected readonly retention = httpResource<RetentionSettings>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/parametres/conservation', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });
}
