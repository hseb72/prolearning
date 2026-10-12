import { Component, input, output, signal } from '@angular/core';
import { LABELS } from '../labels';

/** Zone de dépôt d'un fichier (`.drop`) : clic, clavier (champ fichier) ou glisser-déposer. */
@Component({
  selector: 'app-drop-zone',
  template: `
    <label
      class="drop"
      [class.over]="over()"
      (dragover)="dragOver($event)"
      (dragleave)="over.set(false)"
      (drop)="drop($event)"
    >
      <input type="file" class="visually-hidden" [accept]="accept()" (change)="pick($event)" />
      <b>{{ labels.choose }}</b> {{ labels.orDrop }}<br />
      <span class="small muted">{{ hint() }}</span>
    </label>
  `,
})
export class DropZone {
  readonly accept = input('');
  readonly hint = input<string>(LABELS.ui.drop.hint);
  readonly file = output<File>();
  protected readonly labels = LABELS.ui.drop;
  protected readonly over = signal(false);

  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    this.over.set(true);
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.file.emit(file);
  }

  protected pick(event: Event): void {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    if (file) this.file.emit(file);
    field.value = '';
  }
}

/**
 * Rapport d'import : ligne de synthèse, puis une ligne par erreur (« ✕ », rouge) ou
 * avertissement (« ! », ocre).
 */
@Component({
  selector: 'app-import-report',
  host: { class: 'report', 'aria-live': 'polite' },
  template: `
    <div>
      <b>{{ name() }}</b> ·
      @if (errors().length) {
        <span class="e">{{ labels.errors(errors().length) }}</span>
      } @else {
        <span class="ok">{{ labels.valid }}</span>
      }
      @if (warnings().length) {
        · <span class="w">{{ labels.warnings(warnings().length) }}</span>
      }
    </div>
    @for (error of errors(); track $index) {
      <div class="e">
        <span aria-hidden="true">✕ </span><span class="visually-hidden">{{ labels.error }}</span
        >{{ error }}
      </div>
    }
    @for (warning of warnings(); track $index) {
      <div class="w">
        <span aria-hidden="true">! </span><span class="visually-hidden">{{ labels.warning }}</span
        >{{ warning }}
      </div>
    }
    <ng-content />
  `,
})
export class ImportReport {
  readonly name = input.required<string>();
  readonly errors = input<readonly string[]>([]);
  readonly warnings = input<readonly string[]>([]);
  protected readonly labels = LABELS.ui.report;
}
