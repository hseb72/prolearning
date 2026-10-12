import { httpResource } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseDetail, SessionView } from '@shared/catalog';
import { formatRange, sessionDays } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { CatalogService } from '../../core/catalog';
import { LABELS } from '../../labels';
import { ConfirmService } from '../../ui/confirm';
import { Dialog } from '../../ui/dialog';
import { EmptyState } from '../../ui/empty';
import { SessionRow } from '../../ui/session-row';
import { Tag } from '../../ui/tag';
import { ToastService } from '../../ui/toast';
import { SessionForm } from './session-form';

/** Équipe formation : les sessions d'une fiche (programmer, modifier, annuler). */
@Component({
  selector: 'app-course-sessions',
  imports: [RouterLink, Dialog, EmptyState, SessionForm, SessionRow, Tag],
  template: `
    <p class="crumbs">
      <a [routerLink]="['/catalogue', id()]">← {{ labels.back }}</a>
    </p>
    @if (course.isLoading() && !course.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (course.error() || !course.value()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else if (course.value(); as c) {
      <p class="eyebrow">{{ c.theme }}</p>
      <div class="page-head">
        <h1>{{ c.titre }}</h1>
        <a class="btn ghost" [routerLink]="['/catalogue', c.id, 'modifier']">{{ labels.edit }}</a>
      </div>
      <p class="lead">
        @if (c.dureeHeures) {
          {{ labels.duration(c.dureeHeures) }} ·
        }
        {{ labels.manageIntro }}
      </p>
      @if (!c.publiee) {
        <div class="tags">
          <app-tag>{{ labels.draftTag }}</app-tag>
        </div>
      }

      <div class="page-head">
        <h2>{{ labels.sessionsHeading }}</h2>
        <button class="btn" type="button" (click)="edit(null)">{{ f.add }}</button>
      </div>
      @if (!c.sessions.length) {
        <app-empty class="card">{{ labels.noUpcoming }}</app-empty>
      }
      <div class="list">
        @for (s of c.sessions; track s.id) {
          <app-session-row
            [start]="s.debut"
            [heading]="range(s)"
            [modalite]="s.modalite"
            [tags]="tags(s)"
            [remaining]="s.placesRestantes"
            [capacity]="s.places"
            [attr.data-session]="s.id"
          >
            @if (s.annulee) {
              <app-tag>{{ labels.cancelled }}</app-tag>
            } @else if (!isOpen(s)) {
              <app-tag>{{ labels.past }}</app-tag>
            } @else {
              <div class="bo-acts">
                <button
                  class="btn ghost small"
                  type="button"
                  [attr.aria-label]="f.editLabel(range(s))"
                  (click)="edit(s)"
                >
                  {{ f.edit }}
                </button>
                <button
                  class="btn ghost small"
                  type="button"
                  [attr.aria-label]="f.cancelSessionLabel(range(s))"
                  (click)="cancel(s)"
                >
                  {{ f.cancelSession }}
                </button>
              </div>
            }
          </app-session-row>
        }
      </div>

      <app-dialog
        labelledBy="session-form-title"
        [open]="editing() !== undefined"
        (openChange)="$event || editing.set(undefined)"
      >
        @if (editing() !== undefined) {
          <app-session-form
            [courseId]="c.id"
            [session]="editing() ?? null"
            (saved)="onSaved()"
            (closed)="editing.set(undefined)"
          />
        }
      </app-dialog>
    }
  `,
})
export class CoursePage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(CatalogService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly id = input.required<string>();
  protected readonly labels = LABELS.catalog;
  protected readonly f = LABELS.catalog.sessionForm;
  /** Session en cours de saisie : null pour une nouvelle, undefined si le dialogue est fermé. */
  protected readonly editing = signal<SessionView | null | undefined>(undefined);

  protected readonly course = httpResource<CourseDetail>(() => {
    const me = this.auth.me();
    return me
      ? {
          url: `/api/catalogue/${encodeURIComponent(this.id())}`,
          params: { espace: me.space, compte: me.actor.id },
        }
      : undefined;
  });

  protected range(s: SessionView): string {
    return formatRange(s.debut, s.fin);
  }

  protected tags(s: SessionView): string[] {
    const days = sessionDays(s.debut, s.fin);
    return [
      days ? LABELS.sessions.days(days) : LABELS.sessions.halfDay,
      s.lieu ? `${this.labels.place[s.modalite]} : ${s.lieu}` : '',
      s.formateur ? `${this.labels.trainer} : ${s.formateur}` : '',
    ].filter(Boolean);
  }

  protected isOpen(s: SessionView): boolean {
    return !s.annulee && new Date(s.debut) > new Date();
  }

  protected edit(s: SessionView | null): void {
    this.editing.set(s);
  }

  protected onSaved(): void {
    this.editing.set(undefined);
    this.toast.show(this.f.saved);
    this.course.reload();
  }

  protected async cancel(s: SessionView): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.f.cancelSession,
      text: this.f.confirmCancel(this.range(s)),
      confirm: this.f.cancelSession,
      cancel: LABELS.ui.close,
    });
    if (!ok) return;
    try {
      await this.service.cancelSession(s.id);
      this.toast.show(this.f.cancelledDone);
      this.course.reload();
    } catch {
      this.toast.show(this.f.failed);
    }
  }
}
