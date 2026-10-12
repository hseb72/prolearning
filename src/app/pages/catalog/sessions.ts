import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MODALITES, type SessionView } from '@shared/catalog';
import { formatMonth, formatRange } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';

/** Agenda des prochaines sessions en direct, regroupées par mois. */
@Component({
  selector: 'app-sessions',
  imports: [RouterLink],
  template: `
    <h1>{{ labels.title }}</h1>
    <p>{{ labels.intro }}</p>

    @if (sessions.isLoading() && !sessions.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (sessions.error()) {
      <p class="message error" role="alert">{{ labels.loadFailed }}</p>
    } @else {
      <div class="field filter">
        <label for="sessions-modalite">{{ labels.filter }}</label>
        <select id="sessions-modalite" (change)="modalite.set($any($event.target).value)">
          <option value="">{{ labels.all }}</option>
          @for (m of modalites; track m) {
            <option [value]="m">{{ catalog.formats[m] }}</option>
          }
        </select>
      </div>
      @if (!months().length) {
        <p>{{ labels.empty }}</p>
      }
      @for (month of months(); track month.label) {
        <section [attr.aria-labelledby]="'month-' + $index">
          <h2 class="month" [id]="'month-' + $index">{{ month.label }}</h2>
          <ul class="session-list">
            @for (s of month.sessions; track s.id) {
              <li class="session">
                <h3>{{ s.courseTitre }}</h3>
                <p class="session-when">{{ range(s) }}</p>
                <p>
                  {{ catalog.formats[s.modalite] }}
                  @if (s.lieu) {
                    · {{ catalog.place[s.modalite] }} : {{ s.lieu }}
                  }
                </p>
                <p>{{ catalog.seats(s.placesRestantes, s.places) }}</p>
                <a
                  class="button"
                  [routerLink]="['/catalogue', s.courseId]"
                  [attr.aria-label]="labels.courseLabel(s.courseTitre)"
                  >{{ labels.course }}</a
                >
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styleUrl: './catalog.scss',
})
export class SessionsPage {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.sessions;
  protected readonly catalog = LABELS.catalog;
  protected readonly modalites = MODALITES;
  protected readonly modalite = signal('');

  protected readonly sessions = httpResource<SessionView[]>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/sessions', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  protected readonly months = computed(() => {
    const groups: { label: string; sessions: SessionView[] }[] = [];
    for (const s of this.sessions.value() ?? []) {
      if (this.modalite() && s.modalite !== this.modalite()) continue;
      const label = formatMonth(s.debut);
      const last = groups.at(-1);
      if (last?.label === label) last.sessions.push(s);
      else groups.push({ label, sessions: [s] });
    }
    return groups;
  });

  protected range(s: SessionView): string {
    return formatRange(s.debut, s.fin);
  }
}
