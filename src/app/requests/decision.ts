import { Component, input, output, signal } from '@angular/core';
import { LABELS } from '../labels';

let nextId = 0;

/** Commentaire facultatif et deux boutons : accepter (valider, confirmer…) ou refuser. */
@Component({
  selector: 'app-decision',
  template: `
    <div class="fld">
      <label class="l" [for]="uid">{{ commentLabel() }}</label>
      <textarea
        class="inp"
        [id]="uid"
        rows="2"
        maxlength="2000"
        [value]="comment()"
        (input)="comment.set($any($event.target).value)"
      ></textarea>
    </div>
    <div class="bo-acts">
      <button
        class="btn small"
        type="button"
        [disabled]="busy()"
        [attr.aria-label]="acceptLabel()"
        (click)="decided.emit({ accept: true, commentaire: comment().trim() })"
      >
        {{ acceptText() }}
      </button>
      @if (extraText()) {
        <button
          class="btn ghost small"
          type="button"
          [disabled]="busy()"
          [attr.aria-label]="extraLabel()"
          (click)="extra.emit(comment().trim())"
        >
          {{ extraText() }}
        </button>
      }
      <button
        class="btn ghost small"
        type="button"
        [disabled]="busy()"
        [attr.aria-label]="refuseLabel()"
        (click)="decided.emit({ accept: false, commentaire: comment().trim() })"
      >
        {{ labels.refuse }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 10px;
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
  /** Troisième action facultative (« Prendre en charge »), avec le commentaire saisi. */
  readonly extraText = input('');
  readonly extraLabel = input('');
  readonly extra = output<string>();
  protected readonly uid = `decision-${nextId++}`;
  protected readonly labels = LABELS.requests;
  protected readonly comment = signal('');
}
