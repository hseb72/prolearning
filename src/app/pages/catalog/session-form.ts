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
    <form class="panel" (submit)="save($event)" [attr.aria-labelledby]="uid + '-heading'">
      <h3 [id]="uid + '-heading'">{{ session() ? labels.editHeading : labels.add }}</h3>
      <div class="form-grid two">
        <div class="field">
          <label [for]="uid + '-modalite'">{{ labels.modalite }}</label>
          <select [id]="uid + '-modalite'" (change)="modalite.set($any($event.target).value)">
            @for (m of modalites; track m) {
              <option [value]="m" [selected]="m === modalite()">{{ formats[m] }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label [for]="uid + '-places'">{{ labels.places }}</label>
          <input
            [id]="uid + '-places'"
            type="number"
            min="1"
            max="1000"
            required
            [value]="places()"
            (input)="places.set(+$any($event.target).value)"
          />
        </div>
        <div class="field">
          <label [for]="uid + '-debut'">{{ labels.debut }}</label>
          <input
            [id]="uid + '-debut'"
            type="datetime-local"
            required
            [value]="debut()"
            (input)="debut.set($any($event.target).value)"
          />
        </div>
        <div class="field">
          <label [for]="uid + '-fin'">{{ labels.fin }}</label>
          <input
            [id]="uid + '-fin'"
            type="datetime-local"
            required
            [value]="fin()"
            (input)="fin.set($any($event.target).value)"
          />
        </div>
        <div class="field">
          <label [for]="uid + '-lieu'">{{ labels.lieu }}</label>
          <input
            [id]="uid + '-lieu'"
            type="text"
            maxlength="500"
            [attr.aria-describedby]="uid + '-lieu-hint'"
            [value]="lieu()"
            (input)="lieu.set($any($event.target).value)"
          />
          <p class="hint" [id]="uid + '-lieu-hint'">{{ labels.lieuHint }}</p>
        </div>
        <div class="field">
          <label [for]="uid + '-formateur'">{{ labels.formateur }}</label>
          <input
            [id]="uid + '-formateur'"
            type="text"
            maxlength="200"
            [value]="formateur()"
            (input)="formateur.set($any($event.target).value)"
          />
        </div>
      </div>
      <div aria-live="polite">
        @if (error(); as e) {
          <p class="message error" role="alert">{{ e }}</p>
        }
      </div>
      <div class="actions">
        <button class="button primary" type="submit" [disabled]="busy()">{{ labels.save }}</button>
        <button class="button" type="button" (click)="closed.emit()">{{ labels.cancel }}</button>
      </div>
    </form>
  `,
  styleUrl: './catalog.scss',
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
