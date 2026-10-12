import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseDetail, SessionView } from '@shared/catalog';
import { formatRange } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { CatalogService } from '../../core/catalog';
import { apiMessage, RequestsService } from '../../core/requests';
import { LABELS } from '../../labels';
import { ConfirmService } from '../../ui/confirm';
import { Md } from '../../learning/md';
import { SessionForm } from './session-form';

/** Fiche formation : présentation, parcours en ligne associé et sessions. */
@Component({
  selector: 'app-course',
  imports: [RouterLink, Md, SessionForm],
  template: `
    <p>
      <a routerLink="/catalogue">{{ labels.back }}</a>
    </p>
    @if (course.isLoading() && !course.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (course.error() || !course.value()) {
      <p class="message error" role="alert">{{ labels.loadFailed }}</p>
    } @else if (course.value(); as c) {
      <p class="hint">{{ c.theme }}</p>
      <div class="page-heading">
        <h1>{{ c.titre }}</h1>
        @if (team()) {
          <a class="button" [routerLink]="['/catalogue', c.id, 'modifier']">{{ labels.edit }}</a>
        }
      </div>
      @if (!c.publiee) {
        <p class="draft">{{ labels.draft }}</p>
      }
      <app-md [text]="c.resume" />

      <dl class="facts">
        @if (c.dureeHeures) {
          <div>
            <dt>{{ labels.durationLabel }}</dt>
            <dd>{{ labels.duration(c.dureeHeures) }}</dd>
          </div>
        }
        @if (c.public) {
          <div>
            <dt>{{ labels.audience }}</dt>
            <dd>{{ c.public }}</dd>
          </div>
        }
        @if (c.prerequis) {
          <div>
            <dt>{{ labels.prerequisites }}</dt>
            <dd>{{ c.prerequis }}</dd>
          </div>
        }
      </dl>
      @if (c.objectifs.length) {
        <h2>{{ labels.objectives }}</h2>
        <ul>
          @for (o of c.objectifs; track $index) {
            <li>{{ o }}</li>
          }
        </ul>
      }

      @if (c.formationId) {
        <section class="panel" aria-labelledby="online-heading">
          <h2 id="online-heading">{{ labels.online }}</h2>
          <p>{{ labels.onlineText }}</p>
          <a class="button primary" [routerLink]="['/parcours', c.formationId]">{{
            labels.onlineOpen
          }}</a>
        </section>
      }

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">{{ labels.sessionsHeading }}</h2>
        <div aria-live="polite">
          @if (notice(); as n) {
            <p class="message success" role="status">{{ n }}</p>
          }
        </div>
        @if (!c.sessions.length) {
          <p>{{ labels.noUpcoming }}</p>
        }
        <ul class="session-list">
          @for (s of c.sessions; track s.id) {
            <li class="session" [class.inactive]="!isOpen(s)">
              @if (s.annulee) {
                <p class="status">{{ labels.cancelled }}</p>
              } @else if (!isOpen(s)) {
                <p class="status">{{ labels.past }}</p>
              }
              <p class="session-when">{{ range(s) }}</p>
              <p>
                {{ labels.formats[s.modalite] }}
                @if (s.lieu) {
                  · {{ labels.place[s.modalite] }} : {{ s.lieu }}
                }
              </p>
              @if (s.formateur) {
                <p>{{ labels.trainer }} : {{ s.formateur }}</p>
              }
              <p [class.full]="s.placesRestantes === 0">
                {{ labels.seats(s.placesRestantes, s.places) }}
              </p>
              @if (isOpen(s) && c.publiee) {
                @if (c.mesDemandes[s.id]; as mine) {
                  <p>
                    <strong>{{ r.yourRequest(r.status[mine.statut]) }}</strong> ·
                    <a routerLink="/demandes">{{ r.seeMine }}</a>
                  </p>
                } @else if (s.placesRestantes > 0) {
                  @if (asking() === s.id) {
                    <form
                      class="panel"
                      [attr.aria-label]="r.askHeading(range(s))"
                      (submit)="ask($event, s)"
                    >
                      <p class="hint">{{ r.askInfo }}</p>
                      <div class="field">
                        <label [for]="'motif-' + s.id">{{ r.askMotif }}</label>
                        <textarea
                          [id]="'motif-' + s.id"
                          rows="3"
                          maxlength="2000"
                          [value]="motif()"
                          (input)="motif.set($any($event.target).value)"
                        ></textarea>
                      </div>
                      @if (askError(); as e) {
                        <p class="message error" role="alert">{{ e }}</p>
                      }
                      <div class="actions">
                        <button class="button primary" type="submit" [disabled]="busy()">
                          {{ r.askSend }}
                        </button>
                        <button class="button" type="button" (click)="asking.set(null)">
                          {{ r.askCancel }}
                        </button>
                      </div>
                    </form>
                  } @else {
                    <div class="actions">
                      <button
                        class="button primary"
                        type="button"
                        [attr.aria-label]="r.askLabel(range(s))"
                        (click)="openAsk(s.id)"
                      >
                        {{ r.ask }}
                      </button>
                    </div>
                  }
                }
              }
              @if (team() && !s.annulee) {
                @if (editing() === s.id) {
                  <app-session-form
                    [courseId]="c.id"
                    [session]="s"
                    (saved)="onSaved(labels.sessionForm.saved)"
                    (closed)="editing.set(null)"
                  />
                } @else {
                  <div class="actions">
                    <button
                      class="button"
                      type="button"
                      [attr.aria-label]="labels.sessionForm.editLabel(range(s))"
                      (click)="editing.set(s.id)"
                    >
                      {{ labels.sessionForm.edit }}
                    </button>
                    <button
                      class="button"
                      type="button"
                      [attr.aria-label]="labels.sessionForm.cancelSessionLabel(range(s))"
                      (click)="cancel(s)"
                    >
                      {{ labels.sessionForm.cancelSession }}
                    </button>
                  </div>
                }
              }
            </li>
          }
        </ul>

        @if (team()) {
          @if (adding()) {
            <app-session-form
              [courseId]="c.id"
              (saved)="onSaved(labels.sessionForm.saved)"
              (closed)="adding.set(false)"
            />
          } @else {
            <button class="button primary" type="button" (click)="adding.set(true)">
              {{ labels.sessionForm.add }}
            </button>
          }
        }
      </section>
    }
  `,
  styleUrl: './catalog.scss',
})
export class CoursePage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(CatalogService);
  private readonly requests = inject(RequestsService);
  private readonly confirm = inject(ConfirmService);
  readonly id = input.required<string>();
  protected readonly labels = LABELS.catalog;
  protected readonly r = LABELS.requests;
  /** Session dont le formulaire de demande d'inscription est ouvert. */
  protected readonly asking = signal<number | null>(null);
  protected readonly motif = signal('');
  protected readonly askError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly team = computed(() => this.auth.hasRole('training'));
  protected readonly adding = signal(false);
  protected readonly editing = signal<number | null>(null);
  protected readonly notice = signal<string | null>(null);

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

  protected isOpen(s: SessionView): boolean {
    return !s.annulee && new Date(s.debut) > new Date();
  }

  protected onSaved(message: string): void {
    this.adding.set(false);
    this.editing.set(null);
    this.notice.set(message);
    this.course.reload();
  }

  protected openAsk(sessionId: number): void {
    this.motif.set('');
    this.askError.set(null);
    this.asking.set(sessionId);
  }

  protected async ask(event: SubmitEvent, s: SessionView): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.askError.set(null);
    try {
      await this.requests.register(s.id, this.motif().trim());
      this.asking.set(null);
      this.notice.set(this.r.askSent);
      this.course.reload();
    } catch (error) {
      this.askError.set(apiMessage(error, this.r.failed));
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel(s: SessionView): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.labels.sessionForm.cancelSession,
      text: this.labels.sessionForm.confirmCancel(this.range(s)),
      confirm: this.labels.sessionForm.cancelSession,
      cancel: LABELS.ui.close,
    });
    if (!ok) return;
    try {
      await this.service.cancelSession(s.id);
      this.onSaved(this.labels.sessionForm.cancelledDone);
    } catch {
      this.notice.set(this.labels.sessionForm.failed);
    }
  }
}
