import { Component, Injectable, inject, signal } from '@angular/core';

/** Durée d'affichage d'un toast (SPEC-UI § 4). */
const TOAST_MS = 3600;

/**
 * Toasts : un message bref en bas de l'écran, annoncé aux lecteurs d'écran. Les mots
 * entre `**` sont mis en évidence, comme dans le prototype.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string): void {
    clearTimeout(this.timer);
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(null), TOAST_MS);
  }
}

@Component({
  selector: 'app-toast',
  template: `
    <div class="toast" role="status" aria-live="polite" [hidden]="!toast.message()">
      @for (part of parts(); track $index) {
        @if (part.bold) {
          <b>{{ part.text }}</b>
        } @else {
          {{ part.text }}
        }
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toast = inject(ToastService);

  protected parts(): { text: string; bold: boolean }[] {
    const message = this.toast.message() ?? '';
    return message.split('**').map((text, i) => ({ text, bold: i % 2 === 1 }));
  }
}
