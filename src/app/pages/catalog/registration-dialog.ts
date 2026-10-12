import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { Modalite } from '@shared/catalog';
import { formatDate, sessionDays } from '../../catalog/dates';
import { apiMessage, RequestsService } from '../../core/requests';
import { LABELS } from '../../labels';
import { Dialog } from '../../ui/dialog';
import { ToastService } from '../../ui/toast';

/** Ce que le dialogue a besoin de savoir d'une session. */
export interface RegistrationTarget {
  id: number;
  courseTitre: string;
  modalite: Modalite;
  debut: string;
  fin: string;
  lieu: string;
}

/** « 16 novembre 2026 · À distance · Classe virtuelle · 3 jours » */
export function sessionSummary(s: RegistrationTarget): string {
  const days = sessionDays(s.debut, s.fin);
  return [
    formatDate(s.debut),
    LABELS.ui.modalities[s.modalite],
    s.lieu,
    days ? LABELS.sessions.days(days) : LABELS.sessions.halfDay,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Demande d'inscription à une session en direct (SPEC-UI, capture 04) : un message
 * facultatif, puis l'envoi au manager. Le message de l'API (pas de manager rattaché,
 * session complète…) s'affiche dans le dialogue.
 */
@Component({
  selector: 'app-registration-dialog',
  imports: [Dialog],
  template: `
    <app-dialog labelledBy="registration-title" [(open)]="open">
      @if (session(); as s) {
        <p class="eyebrow">{{ r.askEyebrow }}</p>
        <h2 id="registration-title">{{ s.courseTitre }}</h2>
        <p class="muted">{{ summary() }}</p>
        <form class="f" (submit)="send($event, s)">
          <div class="fld">
            <label class="l" for="registration-motif">{{ r.askMotif }}</label>
            <small id="registration-motif-hint">{{ r.askMotifHint }}</small>
            <textarea
              id="registration-motif"
              class="inp"
              rows="3"
              maxlength="2000"
              aria-describedby="registration-motif-hint"
              [value]="motif()"
              (input)="motif.set($any($event.target).value)"
            ></textarea>
          </div>
          <p class="small muted">{{ r.askInfo }}</p>
          <div aria-live="polite">
            @if (error(); as e) {
              <p class="fb bad" role="alert">{{ e }}</p>
            }
          </div>
          <div class="acts">
            <button class="btn ghost" type="button" (click)="open.set(false)">
              {{ r.askCancel }}
            </button>
            <button class="btn" type="submit" [disabled]="busy()">{{ r.askSend }}</button>
          </div>
        </form>
      }
    </app-dialog>
  `,
})
export class RegistrationDialog {
  private readonly requests = inject(RequestsService);
  private readonly toast = inject(ToastService);
  readonly session = input<RegistrationTarget | null>(null);
  readonly open = model(false);
  readonly sent = output<void>();

  protected readonly r = LABELS.requests;
  protected readonly motif = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly summary = computed(() => {
    const s = this.session();
    return s ? sessionSummary(s) : '';
  });

  constructor() {
    // Formulaire vierge à chaque ouverture.
    effect(() => {
      if (this.open())
        untracked(() => {
          this.motif.set('');
          this.error.set(null);
        });
    });
  }

  protected async send(event: SubmitEvent, s: RegistrationTarget): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.requests.register(s.id, this.motif().trim());
      this.open.set(false);
      this.toast.show(this.r.askSentToast(s.courseTitre));
      this.sent.emit();
    } catch (error) {
      this.error.set(apiMessage(error, this.r.failed));
    } finally {
      this.busy.set(false);
    }
  }
}
