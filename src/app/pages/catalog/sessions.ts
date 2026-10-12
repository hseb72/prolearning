import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Modalite, SessionView } from '@shared/catalog';
import { ACTIVE_REGISTRATION, type MyRequests } from '@shared/requests';
import { formatDate, sessionDays } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { EmptyState } from '../../ui/empty';
import { FilterChips } from '../../ui/filter-chips';
import { SessionRow } from '../../ui/session-row';
import { RegistrationDialog, type RegistrationTarget } from './registration-dialog';

type ModaliteFilter = 'toutes' | Modalite;

/** Sessions planifiées (SPEC-UI, capture 03), avec la demande d'inscription en dialogue. */
@Component({
  selector: 'app-sessions',
  imports: [RouterLink, EmptyState, FilterChips, SessionRow, RegistrationDialog],
  template: `
    <p class="eyebrow">{{ labels.eyebrow }}</p>
    <h1>{{ labels.title }}</h1>
    <p class="lead">{{ labels.intro }}</p>

    @if (sessions.isLoading() && !sessions.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (sessions.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else {
      <div class="filters">
        <app-filter-chips
          [label]="labels.filter"
          [options]="modaliteOptions"
          [(value)]="modalite"
        />
        <select
          class="search courses"
          [attr.aria-label]="labels.courseFilter"
          (change)="course.set($any($event.target).value)"
        >
          <option value="">{{ labels.allCourses }}</option>
          @for (c of courses(); track c.id) {
            <option [value]="c.id" [selected]="c.id === course()">{{ c.titre }}</option>
          }
        </select>
      </div>
      <p class="visually-hidden" role="status">{{ count() }}</p>
      @if (!filtered().length) {
        <app-empty class="card">
          {{ labels.empty }}
          @if (manager()) {
            <a class="link" routerLink="/demandes/sur-mesure">{{ labels.askCustom }}</a>
          }
        </app-empty>
      }
      <div class="list">
        @for (s of filtered(); track s.id) {
          <app-session-row
            [start]="s.debut"
            [heading]="s.courseTitre"
            [modalite]="s.modalite"
            [tags]="tags(s)"
            [remaining]="s.placesRestantes"
            [capacity]="s.places"
          >
            @if (mine().has(s.id)) {
              <a class="btn ghost small" routerLink="/demandes">{{ labels.sent }}</a>
            } @else if (s.placesRestantes > 0) {
              <button
                class="btn small"
                type="button"
                [attr.aria-label]="labels.askLabel(s.courseTitre, day(s))"
                (click)="ask(s)"
              >
                {{ labels.ask }}
              </button>
            } @else {
              <button class="btn small" type="button" disabled>{{ labels.full }}</button>
            }
          </app-session-row>
        }
      </div>
    }
    <app-registration-dialog
      [session]="target()"
      [(open)]="registering"
      (sent)="mineRes.reload()"
    />
  `,
  styles: `
    .courses {
      flex: 0 1 320px;
    }
  `,
})
export class SessionsPage {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.sessions;
  protected readonly modaliteOptions: { value: ModaliteFilter; label: string }[] = [
    { value: 'toutes', label: LABELS.catalog.chips['all']! },
    { value: 'distance', label: LABELS.catalog.chips['distance']! },
    { value: 'site', label: LABELS.catalog.chips['site']! },
  ];
  protected readonly modalite = signal<ModaliteFilter>('toutes');
  protected readonly course = signal('');
  protected readonly registering = signal(false);
  protected readonly target = signal<RegistrationTarget | null>(null);
  protected readonly manager = computed(() => this.auth.hasRole('manager'));

  private readonly params = computed(() => {
    const me = this.auth.me();
    return me ? { espace: me.space, compte: me.actor.id } : null;
  });
  protected readonly sessions = httpResource<SessionView[]>(() => {
    const params = this.params();
    return params ? { url: '/api/sessions', params } : undefined;
  });
  protected readonly mineRes = httpResource<MyRequests>(() => {
    const params = this.params();
    return params ? { url: '/api/demandes', params } : undefined;
  });

  /** Sessions pour lesquelles la personne a une demande en cours ou une place. */
  protected readonly mine = computed(
    () =>
      new Set(
        (this.mineRes.value()?.inscriptions ?? [])
          .filter((r) => ACTIVE_REGISTRATION.includes(r.statut))
          .map((r) => r.session.id),
      ),
  );

  private readonly upcoming = computed(() =>
    (this.sessions.value() ?? []).filter((s) => !s.annulee && new Date(s.debut) > new Date()),
  );

  protected readonly courses = computed(() => {
    const seen = new Map<string, string>();
    for (const s of this.upcoming()) seen.set(s.courseId, s.courseTitre);
    return [...seen]
      .map(([id, titre]) => ({ id, titre }))
      .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  });

  protected readonly filtered = computed(() =>
    this.upcoming().filter(
      (s) =>
        (this.modalite() === 'toutes' || s.modalite === this.modalite()) &&
        (!this.course() || s.courseId === this.course()),
    ),
  );

  protected readonly count = computed(() => {
    const n = this.filtered().length;
    return `${n} session${n > 1 ? 's' : ''}`;
  });

  protected tags(s: SessionView): string[] {
    const days = sessionDays(s.debut, s.fin);
    return [days ? this.labels.days(days) : this.labels.halfDay, s.lieu].filter(Boolean);
  }

  protected day(s: SessionView): string {
    return formatDate(s.debut);
  }

  protected ask(s: SessionView): void {
    this.target.set(s);
    this.registering.set(true);
  }
}
