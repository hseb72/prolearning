import { httpResource } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import type { RetentionSettings } from '@shared/privacy';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';

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
      <p>{{ labels.deleteText }}</p>
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
  protected readonly labels = LABELS.privacy;
  protected readonly retention = httpResource<RetentionSettings>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/parametres/conservation', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });
}
