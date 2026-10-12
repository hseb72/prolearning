import { Component, input, output, signal } from '@angular/core';
import { LABELS } from '../labels';

let nextId = 0;

/** Commentaire facultatif et deux boutons : accepter (valider, confirmer…) ou refuser. */
@Component({
  selector: 'app-decision',
  template: `
    <div class="decision">
      <label [for]="uid">{{ commentLabel() }}</label>
      <textarea
        [id]="uid"
        rows="2"
        maxlength="2000"
        [value]="comment()"
        (input)="comment.set($any($event.target).value)"
      ></textarea>
      <div class="actions">
        <button
          class="button primary"
          type="button"
          [disabled]="busy()"
          [attr.aria-label]="acceptLabel()"
          (click)="decided.emit({ accept: true, commentaire: comment().trim() })"
        >
          {{ acceptText() }}
        </button>
        <button
          class="button"
          type="button"
          [disabled]="busy()"
          [attr.aria-label]="refuseLabel()"
          (click)="decided.emit({ accept: false, commentaire: comment().trim() })"
        >
          {{ labels.refuse }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .decision {
      display: grid;
      gap: var(--space-1);
      margin-top: var(--space-1);
    }
    textarea {
      max-width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-text-muted);
      border-radius: var(--radius);
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
  `,
})
export class DecisionForm {
  readonly acceptText = input.required<string>();
  readonly acceptLabel = input.required<string>();
  readonly refuseLabel = input.required<string>();
  readonly commentLabel = input<string>(LABELS.requests.comment);
  readonly busy = input(false);
  readonly decided = output<{ accept: boolean; commentaire: string }>();
  protected readonly uid = `decision-${nextId++}`;
  protected readonly labels = LABELS.requests;
  protected readonly comment = signal('');
}
