import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseCard, Format } from '@shared/catalog';
import { formatDay } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { Md } from '../../learning/md';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Catalogue des formations, avec recherche et filtres (thème, format). */
@Component({
  selector: 'app-catalog',
  imports: [RouterLink, Md],
  template: `
    <div class="page-heading">
      <h1>{{ labels.title }}</h1>
      @if (team()) {
        <a class="button primary" routerLink="/catalogue/nouvelle">{{ labels.newCourse }}</a>
      }
    </div>
    <p>{{ labels.intro }}</p>

    @if (courses.isLoading() && !courses.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (courses.error()) {
      <p class="message error" role="alert">{{ labels.loadFailed }}</p>
    } @else if (!courses.value()?.length) {
      <p>{{ labels.emptyCatalog }}</p>
    } @else {
      <form
        class="filters"
        role="search"
        [attr.aria-label]="labels.filters"
        (submit)="$event.preventDefault()"
      >
        <div class="field">
          <label for="catalog-search">{{ labels.search }}</label>
          <input
            id="catalog-search"
            type="search"
            [placeholder]="labels.searchHint"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </div>
        <div class="field">
          <label for="catalog-theme">{{ labels.theme }}</label>
          <select id="catalog-theme" (change)="theme.set($any($event.target).value)">
            <option value="">{{ labels.allThemes }}</option>
            @for (t of themes(); track t) {
              <option [value]="t" [selected]="t === theme()">{{ t }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="catalog-format">{{ labels.format }}</label>
          <select id="catalog-format" (change)="format.set($any($event.target).value)">
            <option value="">{{ labels.allFormats }}</option>
            @for (f of formatOptions; track f) {
              <option [value]="f" [selected]="f === format()">{{ labels.formats[f] }}</option>
            }
          </select>
        </div>
      </form>

      <p role="status" class="hint">{{ labels.results(filtered().length) }}</p>
      @if (!filtered().length) {
        <p>{{ labels.empty }}</p>
      }
      <ul class="course-list">
        @for (course of filtered(); track course.id) {
          <li class="course-card">
            <p class="hint">{{ course.theme }}</p>
            <h2>{{ course.titre }}</h2>
            @if (!course.publiee) {
              <p class="draft">{{ labels.draft }}</p>
            }
            <app-md [text]="course.resume" />
            <ul class="tags" [attr.aria-label]="labels.formatsOffered">
              @for (f of course.formats; track f) {
                <li class="tag" [attr.data-format]="f">{{ labels.formats[f] }}</li>
              }
            </ul>
            <p class="hint">
              @if (course.dureeHeures) {
                {{ labels.duration(course.dureeHeures) }} ·
              }
              {{
                course.prochaineSession
                  ? labels.nextSession(day(course.prochaineSession))
                  : labels.noSession
              }}
            </p>
            <a
              class="button"
              [routerLink]="['/catalogue', course.id]"
              [attr.aria-label]="labels.seeLabel(course.titre)"
              >{{ labels.see }}</a
            >
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './catalog.scss',
})
export class CatalogPage {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.catalog;
  protected readonly formatOptions: Format[] = ['distance', 'site', 'en-ligne'];
  protected readonly team = computed(() => this.auth.hasRole('training'));
  protected readonly query = signal('');
  protected readonly theme = signal('');
  protected readonly format = signal('');

  protected readonly courses = httpResource<CourseCard[]>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/catalogue', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  protected readonly themes = computed(() =>
    [...new Set((this.courses.value() ?? []).map((c) => c.theme))].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    ),
  );

  protected readonly filtered = computed(() => {
    const q = normalize(this.query().trim());
    const theme = this.theme();
    const format = this.format() as Format | '';
    return (this.courses.value() ?? []).filter(
      (c) =>
        (!theme || c.theme === theme) &&
        (!format || c.formats.includes(format)) &&
        (!q || normalize(`${c.titre} ${c.theme} ${c.resume}`).includes(q)),
    );
  });

  protected day(iso: string): string {
    return formatDay(iso);
  }
}
