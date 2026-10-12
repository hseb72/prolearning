import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { MODALITES, type Modalite, type SessionView } from '@shared/catalog';
import { isoToParisLocal, parisLocalToIso } from '../../catalog/dates';
import { CatalogService } from '../../core/catalog';
import { LABELS } from '../../labels';

let nextId = 0;

/** Saisie d'une session (création ou modification), par l'équipe formation. */
@Component({
  selector: 'app-session-form',
  template: `
    <form class="f" (submit)="save($event)" aria-labelledby="session-form-title">
      <h2 id="session-form-title">{{ session() ? labels.editHeading : labels.add }}</h2>
      <div class="row2">
        <div class="fld">
          <label class="l" [for]="uid + '-modalite'">{{ labels.modalite }}</label>
          <select
            class="inp"
            [id]="uid + '-modalite'"
            (change)="modalite.set($any($event.target).value)"
          >
            @for (m of modalites; track m) {
              <option [value]="m" [selected]="m === modalite()">{{ formats[m] }}</option>
            }
          </select>
        </div>
        <div class="fld">
          <label class="l" [for]="uid + '-places'">{{ labels.places }}</label>
          <input
            class="inp"
            [id]="uid + '-places'"
            type="number"
            min="1"
            max="1000"
            required
            [value]="places()"
            (input)="places.set(+$any($event.target).value)"
          />
        </div>
        <div class="fld">
          <label class="l" [for]="uid + '-debut'">{{ labels.debut }}</label>
          <input
            class="inp"
            [id]="uid + '-debut'"
            type="datetime-local"
            required
            [value]="debut()"
            (input)="debut.set($any($event.target).value)"
          />
        </div>
        <div class="fld">
          <label class="l" [for]="uid + '-fin'">{{ labels.fin }}</label>
          <input
            class="inp"
            [id]="uid + '-fin'"
            type="datetime-local"
            required
            [value]="fin()"
            (input)="fin.set($any($event.target).value)"
          />
        </div>
      </div>
      <div class="fld">
        <label class="l" [for]="uid + '-lieu'">{{ labels.lieu }}</label>
        <small [id]="uid + '-lieu-hint'">{{ labels.lieuHint }}</small>
        <input
          class="inp"
          [id]="uid + '-lieu'"
          type="text"
          maxlength="500"
          [attr.aria-describedby]="uid + '-lieu-hint'"
          [value]="lieu()"
          (input)="lieu.set($any($event.target).value)"
        />
      </div>
      <div class="fld">
        <label class="l" [for]="uid + '-formateur'">{{ labels.formateur }}</label>
        <input
          class="inp"
          [id]="uid + '-formateur'"
          type="text"
          maxlength="200"
          [value]="formateur()"
          (input)="formateur.set($any($event.target).value)"
        />
      </div>
      <div aria-live="polite">
        @if (error(); as e) {
          <p class="fb bad" role="alert">{{ e }}</p>
        }
      </div>
      <div class="acts">
        <button class="btn ghost" type="button" (click)="closed.emit()">{{ labels.cancel }}</button>
        <button class="btn" type="submit" [disabled]="busy()">{{ labels.save }}</button>
      </div>
    </form>
  `,
  styles: `
    h2 {
      margin: 0;
    }
  `,
})
export class SessionForm implements OnInit {
  private readonly service = inject(CatalogService);
  readonly courseId = input.required<string>();
  /** Session à modifier ; absente pour une création. */
  readonly session = input<SessionView | null>(null);
  readonly saved = output<SessionView>();
  readonly closed = output<void>();

  protected readonly uid = `session-form-${nextId++}`;
  protected readonly labels = LABELS.catalog.sessionForm;
  protected readonly formats = LABELS.catalog.formats;
  protected readonly modalites = MODALITES;
  protected readonly modalite = signal<Modalite>('distance');
  protected readonly debut = signal('');
  protected readonly fin = signal('');
  protected readonly lieu = signal('');
  protected readonly formateur = signal('');
  protected readonly places = signal(12);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const s = this.session();
    if (s) {
      this.modalite.set(s.modalite);
      this.debut.set(isoToParisLocal(s.debut));
      this.fin.set(isoToParisLocal(s.fin));
      this.lieu.set(s.lieu);
      this.formateur.set(s.formateur);
      this.places.set(s.places);
    }
  }

  protected async save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.error.set(null);
    if (!this.debut() || !this.fin() || this.fin() <= this.debut()) {
      this.error.set(this.labels.invalidDates);
      return;
    }
    const input = {
      modalite: this.modalite(),
      debut: parisLocalToIso(this.debut()),
      fin: parisLocalToIso(this.fin()),
      lieu: this.lieu().trim(),
      formateur: this.formateur().trim(),
      places: this.places(),
    };
    this.busy.set(true);
    try {
      const existing = this.session();
      this.saved.emit(
        existing
          ? await this.service.updateSession(existing.id, input)
          : await this.service.addSession(this.courseId(), input),
      );
    } catch (error) {
      const message = error instanceof HttpErrorResponse ? error.error?.message : null;
      this.error.set(typeof message === 'string' ? message : this.labels.failed);
    } finally {
      this.busy.set(false);
    }
  }
}
