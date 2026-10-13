import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import type { CourseCard } from '@shared/catalog';
import type { CustomModalite } from '@shared/requests';
import { AuthService } from '../../core/auth';
import { apiMessage, RequestsService } from '../../core/requests';
import { LABELS } from '../../labels';
import { ToastService } from '../../ui/toast';

/** Manager : demande de session sur mesure pour son équipe. */
@Component({
  selector: 'app-custom-request-form',
  template: `
    <p class="eyebrow">{{ labels.customEyebrow }}</p>
    <h1>{{ labels.customTitle }}</h1>
    <p class="lead">{{ labels.customIntro }}</p>
    <form class="card f" (submit)="send($event)">
      <div class="fld">
        <label class="l" for="custom-course">{{ f.course }}</label>
        <select class="inp" id="custom-course" (change)="pickCourse($any($event.target).value)">
          <option value="">{{ f.noCourse }}</option>
          @for (c of choices(); track c.id) {
            <option [value]="c.id" [selected]="c.id === courseId()">{{ c.titre }}</option>
          }
        </select>
      </div>
      <div class="fld">
        <label class="l" for="custom-sujet">{{ f.sujet }}</label>
        <small id="custom-sujet-hint">{{ f.sujetHint }}</small>
        <input
          class="inp"
          id="custom-sujet"
          type="text"
          required
          maxlength="300"
          aria-describedby="custom-sujet-hint"
          [value]="sujet()"
          (input)="sujet.set($any($event.target).value)"
        />
      </div>
      <div class="row2">
        <div class="fld">
          <label class="l" for="custom-participants">{{ f.participants }}</label>
          <input
            class="inp"
            id="custom-participants"
            type="number"
            min="1"
            max="500"
            required
            [value]="participants()"
            (input)="participants.set(+$any($event.target).value)"
          />
        </div>
        <div class="fld">
          <label class="l" for="custom-periode">{{ f.periode }}</label>
          <small id="custom-periode-hint">{{ f.periodeHint }}</small>
          <input
            class="inp"
            id="custom-periode"
            type="text"
            maxlength="300"
            aria-describedby="custom-periode-hint"
            [value]="periode()"
            (input)="periode.set($any($event.target).value)"
          />
        </div>
      </div>
      <fieldset>
        <legend>{{ f.modalite }}</legend>
        <div class="radios">
          @for (m of modalites; track m) {
            <label>
              <input
                type="radio"
                name="custom-modalite"
                [value]="m"
                [checked]="m === modalite()"
                (change)="modalite.set(m)"
              />
              {{ labels.modalites[m] }}
            </label>
          }
        </div>
      </fieldset>
      <div class="fld">
        <label class="l" for="custom-details">{{ f.details }}</label>
        <small id="custom-details-hint">{{ f.detailsHint }}</small>
        <textarea
          class="inp"
          id="custom-details"
          rows="4"
          maxlength="5000"
          aria-describedby="custom-details-hint"
          [value]="details()"
          (input)="details.set($any($event.target).value)"
        ></textarea>
      </div>
      <p class="small muted">{{ labels.customNote }}</p>
      <div aria-live="polite">
        @if (error(); as e) {
          <p class="fb bad" role="alert">{{ e }}</p>
        }
      </div>
      <div>
        <button class="btn" type="submit" [disabled]="busy()">{{ f.send }}</button>
      </div>
    </form>
  `,
})
export class CustomRequestFormPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RequestsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly labels = LABELS.requests;
  protected readonly f = LABELS.requests.form;
  protected readonly modalites: CustomModalite[] = ['distance', 'site', 'indifferent'];
  /** Fiche choisie depuis le catalogue (« Demander une session pour mon équipe »). */
  readonly fiche = input<string>();
  protected readonly courseId = signal('');
  protected readonly sujet = signal('');
  protected readonly modalite = signal<CustomModalite>('indifferent');
  protected readonly participants = signal(6);
  protected readonly periode = signal('');
  protected readonly details = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly courses = httpResource<CourseCard[]>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/catalogue', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  /** Fiches du catalogue : un parcours en ligne sans fiche ne se demande pas en session. */
  protected readonly choices = computed(() =>
    (this.courses.value() ?? []).filter((c) => !c.parcoursSeul),
  );

  constructor() {
    // Fiche passée en paramètre : formation présélectionnée, sujet proposé.
    effect(() => {
      const id = this.fiche();
      const course = this.choices().find((c) => c.id === id);
      if (course) untracked(() => this.pickCourse(course.id));
    });
  }

  protected pickCourse(id: string): void {
    this.courseId.set(id);
    const course = this.choices().find((c) => c.id === id);
    if (course && !this.sujet().trim()) this.sujet.set(course.titre);
  }

  protected async send(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.service.createCustom({
        courseId: this.courseId() || null,
        sujet: this.sujet().trim(),
        modalite: this.modalite(),
        participants: this.participants(),
        periode: this.periode().trim(),
        details: this.details().trim(),
      });
      this.toast.show(this.f.sent);
      await this.router.navigate(['/demandes']);
    } catch (error) {
      this.error.set(apiMessage(error, this.labels.failed));
    } finally {
      this.busy.set(false);
    }
  }
}
