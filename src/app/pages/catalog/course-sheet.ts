import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseDetail, Format, SessionView } from '@shared/catalog';
import { formatDate } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { Md } from '../../learning/md';
import { StatusPill } from '../../ui/status';
import { Tag } from '../../ui/tag';
import { RegistrationDialog } from './registration-dialog';

/** Pastille de format : « En ligne » vert, « À distance » bleu, « Sur site » ocre. */
export const FORMAT_KIND: Record<Format, 'online' | 'distance' | 'site'> = {
  'en-ligne': 'online',
  distance: 'distance',
  site: 'site',
};

/**
 * Contenu de la fiche formation (SPEC-UI, capture 02), affiché dans le dialogue du
 * catalogue : thème, titre, pastilles, objectifs, public, prérequis, durée, prochaines
 * sessions avec inscription, puis les actions.
 */
@Component({
  selector: 'app-course-sheet',
  imports: [RouterLink, Md, StatusPill, Tag, RegistrationDialog],
  template: `
    @if (course.isLoading() && !course.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
      <h2 class="visually-hidden" id="course-sheet-title">{{ s.label }}</h2>
    } @else if (course.error() || !course.value()) {
      <h2 id="course-sheet-title">{{ s.label }}</h2>
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
      <div class="acts">
        <button class="btn ghost" type="button" (click)="closed.emit()">{{ s.close }}</button>
      </div>
    } @else if (course.value(); as c) {
      <div>
        <p class="eyebrow">{{ c.theme }}</p>
        <h2 id="course-sheet-title">{{ c.titre }}</h2>
        <div class="tags">
          @for (f of c.formats; track f) {
            <app-tag [kind]="kinds[f]">{{ labels.chips[f] }}</app-tag>
          }
          @if (!c.publiee) {
            <app-tag>{{ labels.draftTag }}</app-tag>
          }
        </div>
      </div>
      <app-md [text]="c.resume" />
      @if (c.objectifs.length) {
        <div>
          <h3>{{ labels.objectives }}</h3>
          <ul class="objectives">
            @for (o of c.objectifs; track $index) {
              <li>{{ o }}</li>
            }
          </ul>
        </div>
      }
      <p class="facts">
        <b>{{ s.audience }}</b> {{ c.public || s.none }}<br />
        <b>{{ s.prerequisites }}</b> {{ c.prerequis || s.none }}
        @if (duration(c); as d) {
          <br /><b>{{ s.duration }}</b> {{ d }}
        }
      </p>
      <div>
        <h3>{{ s.nextSessions }}</h3>
        @if (!upcoming().length) {
          <p class="muted">{{ s.noUpcoming }}</p>
        } @else {
          <ul class="next">
            @for (session of upcoming(); track session.id) {
              <li>
                <span>{{ line(session) }}</span>
                @if (c.mesDemandes[session.id]; as mine) {
                  <a routerLink="/demandes"><app-status [status]="mine.statut" /></a>
                } @else if (!c.publiee) {
                  <span></span>
                } @else if (session.placesRestantes > 0) {
                  <button
                    class="link"
                    type="button"
                    [attr.aria-label]="s.registerLabel(line(session))"
                    (click)="register(session, c)"
                  >
                    {{ s.register }}
                  </button>
                } @else {
                  <span class="muted small">{{ s.full }}</span>
                }
              </li>
            }
          </ul>
        }
      </div>
      <div class="acts">
        @if (c.formationId) {
          <a class="btn" [routerLink]="['/parcours', c.formationId]">{{ s.startOnline }}</a>
        }
        @if (manager()) {
          <a class="btn ghost" routerLink="/demandes/sur-mesure" [queryParams]="{ fiche: c.id }">{{
            s.askTeam
          }}</a>
        }
        @if (team()) {
          <a class="btn ghost" [routerLink]="['/catalogue', c.id, 'modifier']">{{ labels.edit }}</a>
          <a class="btn ghost" [routerLink]="['/catalogue', c.id, 'sessions']">{{ s.manage }}</a>
        }
        <button class="btn ghost" type="button" (click)="closed.emit()">{{ s.close }}</button>
      </div>
    }
    <app-registration-dialog [session]="target()" [(open)]="registering" (sent)="course.reload()" />
  `,
  styles: `
    :host {
      display: grid;
      gap: 14px;
    }
    h2 {
      margin: 0;
    }
    h3 {
      margin: 0 0 8px;
    }
    .objectives {
      margin: 0;
      padding-left: 20px;
    }
    .facts {
      margin: 0;
    }
    .next {
      list-style: none;
      margin: 0;
      padding: 0;

      li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--line);
      }
      a {
        text-decoration: none;
      }
    }
    .acts {
      justify-content: flex-start;
      margin-top: 4px;
    }
  `,
})
export class CourseSheet {
  private readonly auth = inject(AuthService);
  readonly id = input.required<string>();
  readonly closed = output<void>();

  protected readonly labels = LABELS.catalog;
  protected readonly s = LABELS.catalog.sheet;
  protected readonly kinds = FORMAT_KIND;
  protected readonly team = computed(() => this.auth.hasRole('training'));
  protected readonly manager = computed(() => this.auth.hasRole('manager'));
  protected readonly registering = signal(false);
  protected readonly target = signal<(SessionView & { courseTitre: string }) | null>(null);

  protected readonly course = httpResource<CourseDetail>(() => {
    const me = this.auth.me();
    return me
      ? {
          url: `/api/catalogue/${encodeURIComponent(this.id())}`,
          params: { espace: me.space, compte: me.actor.id },
        }
      : undefined;
  });

  /** Sessions ouvertes à venir (l'équipe formation reçoit aussi les passées et annulées). */
  protected readonly upcoming = computed(() =>
    (this.course.value()?.sessions ?? []).filter(
      (s) => !s.annulee && new Date(s.debut) > new Date(),
    ),
  );

  protected line(s: SessionView): string {
    return [formatDate(s.debut), this.labels.chips[s.modalite], s.lieu].filter(Boolean).join(' · ');
  }

  protected duration(c: CourseDetail): string {
    const parts = [
      c.dureeHeures ? this.labels.duration(c.dureeHeures) : '',
      c.formationId ? this.s.online : '',
    ].filter(Boolean);
    return parts.join(' · ');
  }

  protected register(session: SessionView, c: CourseDetail): void {
    this.target.set({ ...session, courseTitre: c.titre });
    this.registering.set(true);
  }
}
