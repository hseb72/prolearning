import { httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { CourseCard } from '@shared/catalog';
import type { CustomModalite } from '@shared/requests';
import { AuthService } from '../../core/auth';
import { apiMessage, RequestsService } from '../../core/requests';
import { LABELS } from '../../labels';

/** Manager : demande de session sur mesure pour son équipe. */
@Component({
  selector: 'app-custom-request-form',
  imports: [RouterLink],
  template: `
    <p>
      <a routerLink="/demandes">{{ nav.myRequests }}</a>
    </p>
    <h1>{{ labels.customTitle }}</h1>
    <p>{{ labels.customIntro }}</p>
    <form class="form-grid" (submit)="send($event)">
      <div class="field">
        <label for="custom-course">{{ f.course }}</label>
        <select id="custom-course" (change)="courseId.set($any($event.target).value)">
          <option value="">{{ f.noCourse }}</option>
          @for (c of courses.value() ?? []; track c.id) {
            <option [value]="c.id">{{ c.titre }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label for="custom-sujet">{{ f.sujet }}</label>
        <input
          id="custom-sujet"
          type="text"
          required
          maxlength="300"
          aria-describedby="custom-sujet-hint"
          [value]="sujet()"
          (input)="sujet.set($any($event.target).value)"
        />
        <p class="hint" id="custom-sujet-hint">{{ f.sujetHint }}</p>
      </div>
      <div class="form-grid two">
        <div class="field">
          <label for="custom-modalite">{{ f.modalite }}</label>
          <select id="custom-modalite" (change)="modalite.set($any($event.target).value)">
            @for (m of modalites; track m) {
              <option [value]="m" [selected]="m === modalite()">{{ labels.modalites[m] }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="custom-participants">{{ f.participants }}</label>
          <input
            id="custom-participants"
            type="number"
            min="1"
            max="500"
            required
            [value]="participants()"
            (input)="participants.set(+$any($event.target).value)"
          />
        </div>
      </div>
      <div class="field">
        <label for="custom-periode">{{ f.periode }}</label>
        <input
          id="custom-periode"
          type="text"
          maxlength="300"
          aria-describedby="custom-periode-hint"
          [value]="periode()"
          (input)="periode.set($any($event.target).value)"
        />
        <p class="hint" id="custom-periode-hint">{{ f.periodeHint }}</p>
      </div>
      <div class="field">
        <label for="custom-details">{{ f.details }}</label>
        <textarea
          id="custom-details"
          maxlength="5000"
          [value]="details()"
          (input)="details.set($any($event.target).value)"
        ></textarea>
      </div>
      <div aria-live="polite">
        @if (error(); as e) {
          <p class="message error" role="alert">{{ e }}</p>
        }
      </div>
      <div class="actions">
        <button class="button primary" type="submit" [disabled]="busy()">{{ f.send }}</button>
        <a class="button" routerLink="/demandes">{{ f.cancel }}</a>
      </div>
    </form>
  `,
  styleUrls: ['../catalog/catalog.scss', './requests.scss'],
})
export class CustomRequestFormPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(RequestsService);
  private readonly router = inject(Router);
  protected readonly labels = LABELS.requests;
  protected readonly f = LABELS.requests.form;
  protected readonly nav = LABELS.nav;
  protected readonly modalites: CustomModalite[] = ['indifferent', 'distance', 'site'];
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
      await this.router.navigate(['/demandes'], { state: { notice: this.f.sent } });
    } catch (error) {
      this.error.set(apiMessage(error, this.labels.failed));
    } finally {
      this.busy.set(false);
    }
  }
}
