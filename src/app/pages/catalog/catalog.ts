import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { CourseCard as Course, Format, SessionView } from '@shared/catalog';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { CourseCard } from '../../ui/course-card';
import { Dialog } from '../../ui/dialog';
import { EmptyState } from '../../ui/empty';
import { FilterChips } from '../../ui/filter-chips';
import { Stat } from '../../ui/stat';
import { Tag } from '../../ui/tag';
import { CourseSheet, FORMAT_KIND, orderedFormats } from './course-sheet';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

type FormatFilter = 'toutes' | Format;

/**
 * Catalogue (SPEC-UI, capture 01) : chiffres clés, filtres, cartes. La fiche d'une
 * formation s'ouvre en dialogue par-dessus, à l'adresse /catalogue/:id.
 */
@Component({
  selector: 'app-catalog',
  imports: [RouterLink, CourseCard, CourseSheet, Dialog, EmptyState, FilterChips, Stat, Tag],
  template: `
    <p class="eyebrow">{{ labels.eyebrow }}</p>
    <div class="page-head">
      <h1>{{ labels.heading }}</h1>
      @if (team()) {
        <a class="btn" routerLink="/catalogue/nouvelle">{{ labels.newCourse }}</a>
      }
    </div>
    <p class="lead">{{ labels.intro }}</p>

    @if (courses.isLoading() && !courses.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (courses.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else {
      <div class="stats">
        <app-stat [value]="all().length" [label]="labels.stats.courses(all().length)" />
        <app-stat [value]="sessionCount()" [label]="labels.stats.sessions(sessionCount())" />
        <app-stat [value]="onlineCount()" [label]="labels.stats.online" />
      </div>
      <div class="filters" role="search" [attr.aria-label]="labels.filters">
        <app-filter-chips [label]="labels.format" [options]="formatOptions" [(value)]="format" />
        <select
          class="search"
          [attr.aria-label]="labels.theme"
          (change)="theme.set($any($event.target).value)"
        >
          <option value="">{{ labels.allThemes }}</option>
          @for (t of themes(); track t) {
            <option [value]="t" [selected]="t === theme()">{{ t }}</option>
          }
        </select>
        <input
          class="search"
          type="search"
          [attr.aria-label]="labels.searchPlaceholder"
          [placeholder]="labels.searchPlaceholder"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </div>
      <p class="visually-hidden" role="status">{{ labels.results(filtered().length) }}</p>
      @if (!filtered().length) {
        <app-empty>{{ all().length ? labels.emptyFilter : labels.emptyCatalog }}</app-empty>
      } @else {
        <div class="grid">
          @for (c of filtered(); track c.id) {
            <app-course-card
              [theme]="c.theme"
              [heading]="c.titre"
              [modes]="modes(c)"
              [duration]="c.dureeHeures ? labels.duration(c.dureeHeures) : ''"
              [info]="labels.cardInfo(!!c.formationId, sessionsOf(c.id))"
            >
              @if (!c.publiee) {
                <app-tag>{{ labels.draftTag }}</app-tag>
              }
              <a
                class="btn small"
                [routerLink]="['/catalogue', c.id]"
                [attr.aria-label]="labels.seeLabel(c.titre)"
                >{{ labels.see }}</a
              >
            </app-course-card>
          }
        </div>
      }
    }

    <app-dialog labelledBy="course-sheet-title" [open]="!!id()" (openChange)="$event || close()">
      @if (id(); as courseId) {
        <app-course-sheet [id]="courseId" (closed)="close()" />
      }
    </app-dialog>
  `,
})
export class CatalogPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Fiche ouverte en dialogue (/catalogue/:id). */
  readonly id = input<string>();

  protected readonly labels = LABELS.catalog;
  protected readonly formatOptions: { value: FormatFilter; label: string }[] = (
    ['toutes', 'en-ligne', 'distance', 'site'] as const
  ).map((value) => ({ value, label: LABELS.catalog.chips[value === 'toutes' ? 'all' : value]! }));
  protected readonly team = computed(() => this.auth.hasRole('training'));
  protected readonly query = signal('');
  protected readonly theme = signal('');
  protected readonly format = signal<FormatFilter>('toutes');

  private readonly params = computed(() => {
    const me = this.auth.me();
    return me ? { espace: me.space, compte: me.actor.id } : null;
  });
  protected readonly courses = httpResource<Course[]>(() => {
    const params = this.params();
    return params ? { url: '/api/catalogue', params } : undefined;
  });
  private readonly sessions = httpResource<SessionView[]>(() => {
    const params = this.params();
    return params ? { url: '/api/sessions', params } : undefined;
  });

  protected readonly all = computed(() => this.courses.value() ?? []);
  private readonly upcoming = computed(() =>
    (this.sessions.value() ?? []).filter((s) => !s.annulee && new Date(s.debut) > new Date()),
  );
  protected readonly sessionCount = computed(() => this.upcoming().length);
  protected readonly onlineCount = computed(() => this.all().filter((c) => c.formationId).length);

  protected readonly themes = computed(() =>
    [...new Set(this.all().map((c) => c.theme))].sort((a, b) => a.localeCompare(b, 'fr')),
  );

  protected readonly filtered = computed(() => {
    const q = normalize(this.query().trim());
    const theme = this.theme();
    const format = this.format();
    return this.all().filter(
      (c) =>
        (!theme || c.theme === theme) &&
        (format === 'toutes' || c.formats.includes(format)) &&
        (!q || normalize(`${c.titre} ${c.theme} ${c.resume}`).includes(q)),
    );
  });

  protected modes(c: Course): ('online' | 'distance' | 'site')[] {
    return orderedFormats(c.formats).map((f) => FORMAT_KIND[f]);
  }

  protected sessionsOf(courseId: string): number {
    return this.upcoming().filter((s) => s.courseId === courseId).length;
  }

  protected close(): void {
    void this.router.navigate(['/catalogue']);
  }
}
