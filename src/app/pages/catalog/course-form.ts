import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { COURSE_ID_PATTERN, type CourseDetail, type FormationOption } from '@shared/catalog';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth';
import { CatalogService } from '../../core/catalog';
import { LABELS } from '../../labels';

/** Création ou modification d'une fiche formation (équipe formation). */
@Component({
  selector: 'app-course-form',
  imports: [RouterLink],
  template: `
    <p>
      <a [routerLink]="id() ? ['/catalogue', id()] : ['/catalogue']">{{ labels.back }}</a>
    </p>
    <h1>{{ id() ? labels.editTitle(titre() || id()!) : labels.newTitle }}</h1>

    @if (id() && !loaded()) {
      <p role="status">{{ labels.loading }}</p>
    } @else {
      <form class="form-grid" (submit)="save($event)">
        @if (!id()) {
          <div class="field">
            <label for="course-id">{{ f.id }}</label>
            <input
              id="course-id"
              type="text"
              required
              maxlength="64"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              aria-describedby="course-id-hint"
              [value]="slug()"
              (input)="slug.set($any($event.target).value)"
            />
            <p class="hint" id="course-id-hint">{{ f.idHint }}</p>
          </div>
        }
        <div class="field">
          <label for="course-titre">{{ f.titre }}</label>
          <input
            id="course-titre"
            type="text"
            required
            maxlength="200"
            [value]="titre()"
            (input)="titre.set($any($event.target).value)"
          />
        </div>
        <div class="field">
          <label for="course-theme">{{ f.theme }}</label>
          <input
            id="course-theme"
            type="text"
            required
            maxlength="100"
            [value]="theme()"
            (input)="theme.set($any($event.target).value)"
          />
        </div>
        <div class="field">
          <label for="course-resume">{{ f.resume }}</label>
          <textarea
            id="course-resume"
            required
            maxlength="5000"
            aria-describedby="course-resume-hint"
            [value]="resume()"
            (input)="resume.set($any($event.target).value)"
          ></textarea>
          <p class="hint" id="course-resume-hint">{{ f.resumeHint }}</p>
        </div>
        <div class="field">
          <label for="course-objectifs">{{ f.objectifs }}</label>
          <textarea
            id="course-objectifs"
            aria-describedby="course-objectifs-hint"
            [value]="objectifs()"
            (input)="objectifs.set($any($event.target).value)"
          ></textarea>
          <p class="hint" id="course-objectifs-hint">{{ f.objectifsHint }}</p>
        </div>
        <div class="form-grid two">
          <div class="field">
            <label for="course-public">{{ f.public }}</label>
            <input
              id="course-public"
              type="text"
              maxlength="1000"
              [value]="audience()"
              (input)="audience.set($any($event.target).value)"
            />
          </div>
          <div class="field">
            <label for="course-prerequis">{{ f.prerequis }}</label>
            <input
              id="course-prerequis"
              type="text"
              maxlength="1000"
              [value]="prerequis()"
              (input)="prerequis.set($any($event.target).value)"
            />
          </div>
          <div class="field">
            <label for="course-duree">{{ f.duree }}</label>
            <input
              id="course-duree"
              type="number"
              min="0.5"
              max="1000"
              step="0.5"
              aria-describedby="course-duree-hint"
              [value]="duree()"
              (input)="duree.set($any($event.target).value)"
            />
            <p class="hint" id="course-duree-hint">{{ f.dureeHint }}</p>
          </div>
          <div class="field">
            <label for="course-formation">{{ f.formation }}</label>
            <select id="course-formation" (change)="formationId.set($any($event.target).value)">
              <option value="">{{ f.noFormation }}</option>
              @for (o of options.value() ?? []; track o.id) {
                <option [value]="o.id" [selected]="o.id === formationId()">{{ o.titre }}</option>
              }
            </select>
          </div>
        </div>
        <div class="checkbox">
          <input
            id="course-publiee"
            type="checkbox"
            [checked]="publiee()"
            (change)="publiee.set($any($event.target).checked)"
          />
          <label for="course-publiee">{{ f.publiee }}</label>
        </div>
        <div aria-live="polite">
          @if (error(); as e) {
            <p class="message error" role="alert">{{ e }}</p>
          }
        </div>
        <div class="actions">
          <button class="button primary" type="submit" [disabled]="busy()">{{ f.save }}</button>
          <a class="button" [routerLink]="id() ? ['/catalogue', id()] : ['/catalogue']">{{
            f.cancel
          }}</a>
        </div>
      </form>
    }
  `,
  styleUrl: './catalog.scss',
})
export class CourseFormPage {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly service = inject(CatalogService);
  private readonly router = inject(Router);
  /** Fiche à modifier ; absente pour une création. */
  readonly id = input<string>();
  protected readonly labels = LABELS.catalog;
  protected readonly f = LABELS.catalog.form;

  protected readonly slug = signal('');
  protected readonly titre = signal('');
  protected readonly theme = signal('');
  protected readonly resume = signal('');
  protected readonly objectifs = signal('');
  protected readonly audience = signal('');
  protected readonly prerequis = signal('');
  protected readonly duree = signal('');
  protected readonly formationId = signal('');
  protected readonly publiee = signal(false);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly options = httpResource<FormationOption[]>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/catalogue-parcours', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  private readonly editing = computed(() => this.id() ?? null);

  constructor() {
    effect(() => {
      const id = this.editing();
      if (id) void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    try {
      const c = await firstValueFrom(
        this.http.get<CourseDetail>(`/api/catalogue/${encodeURIComponent(id)}`),
      );
      this.titre.set(c.titre);
      this.theme.set(c.theme);
      this.resume.set(c.resume);
      this.objectifs.set(c.objectifs.join('\n'));
      this.audience.set(c.public);
      this.prerequis.set(c.prerequis);
      this.duree.set(c.dureeHeures === null ? '' : String(c.dureeHeures));
      this.formationId.set(c.formationId ?? '');
      this.publiee.set(c.publiee);
      this.loaded.set(true);
    } catch {
      this.error.set(this.labels.loadFailed);
      this.loaded.set(true);
    }
  }

  protected async save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    const id = this.id() ?? this.slug().trim();
    if (!COURSE_ID_PATTERN.test(id)) {
      this.error.set(this.f.idHint);
      return;
    }
    const duree = this.duree().trim();
    const input = {
      titre: this.titre().trim(),
      theme: this.theme().trim(),
      resume: this.resume().trim(),
      objectifs: this.objectifs()
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean),
      public: this.audience().trim(),
      prerequis: this.prerequis().trim(),
      dureeHeures: duree ? Number(duree.replace(',', '.')) : null,
      formationId: this.formationId() || null,
      publiee: this.publiee(),
    };
    this.busy.set(true);
    try {
      if (this.id()) await this.service.updateCourse(id, input);
      else await this.service.createCourse({ id, ...input });
      await this.router.navigate(['/catalogue', id]);
    } catch (error) {
      const message = error instanceof HttpErrorResponse ? error.error?.message : null;
      this.error.set(typeof message === 'string' ? message : this.f.failed);
    } finally {
      this.busy.set(false);
    }
  }
}
