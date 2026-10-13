import { Component, input, signal } from '@angular/core';
import { LABELS } from '../labels';
import { copyText } from '../learning/clipboard';

/** Bloc de code sur fond sombre, avec bouton « Copier » (« Copié » pendant 1,8 s). */
@Component({
  selector: 'app-code-block',
  template: `
    <div class="code-block">
      <button type="button" class="cpy" [attr.aria-label]="labels.copyCode" (click)="copy()">
        {{ copied() ? labels.copied : labels.copy }}
      </button>
      <pre
        class="code"
        tabindex="0"
        role="region"
        [attr.aria-label]="labels.codeRegion"
      ><code>{{ code() }}</code></pre>
      <span class="visually-hidden" role="status">{{ announce() }}</span>
    </div>
  `,
})
export class CodeBlock {
  readonly code = input.required<string>();
  protected readonly labels = LABELS.learning;
  protected readonly copied = signal(false);
  protected readonly announce = signal('');

  protected async copy(): Promise<void> {
    const ok = await copyText(this.code());
    this.copied.set(ok);
    this.announce.set(ok ? this.labels.copiedAnnounce : this.labels.copyFailed);
    setTimeout(() => this.copied.set(false), 1800);
  }
}
