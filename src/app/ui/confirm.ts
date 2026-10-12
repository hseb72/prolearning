import {
  afterRenderEffect,
  Component,
  ElementRef,
  Injectable,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LABELS } from '../labels';

export interface ConfirmRequest {
  /** Sur-titre (petites capitales orange). */
  eyebrow?: string;
  title: string;
  text?: string;
  confirm: string;
  cancel?: string;
}

/**
 * Confirmation dans un dialogue natif, à la place de `confirm()` (SPEC-UI § 4) :
 * `await confirmService.ask({...})` rend vrai si la personne confirme.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolve: ((ok: boolean) => void) | null = null;

  ask(request: ConfirmRequest): Promise<boolean> {
    this.resolve?.(false);
    this.request.set(request);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  answer(ok: boolean): void {
    this.resolve?.(ok);
    this.resolve = null;
    this.request.set(null);
  }
}

@Component({
  selector: 'app-confirm',
  template: `
    <dialog #dialog aria-labelledby="confirm-title" (close)="service.answer(false)">
      @if (service.request(); as r) {
        <div class="dlg">
          @if (r.eyebrow) {
            <p class="eyebrow">{{ r.eyebrow }}</p>
          }
          <h2 id="confirm-title">{{ r.title }}</h2>
          @if (r.text) {
            <p class="muted">{{ r.text }}</p>
          }
          <div class="acts">
            <button class="btn ghost" type="button" (click)="close(false)">
              {{ r.cancel ?? labels.cancel }}
            </button>
            <button class="btn" type="button" (click)="close(true)">{{ r.confirm }}</button>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmHost {
  protected readonly service = inject(ConfirmService);
  protected readonly labels = LABELS.ui;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect(() => {
      const el = this.dialog().nativeElement;
      if (this.service.request() && !el.open) el.showModal();
      if (!this.service.request() && el.open) el.close();
    });
  }

  protected close(ok: boolean): void {
    this.service.answer(ok);
  }
}
