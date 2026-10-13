import { Component, computed, input, output, signal } from '@angular/core';
import { LABELS } from '../../labels';
import { Md } from '../md';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';
import { CompleteButton } from './complete-button';

/** Fiches recto/verso pour réviser (§ 6.7). */
@Component({
  selector: 'app-cards',
  imports: [Md, CompleteButton],
  template: `
    <p class="muted">{{ labels.cardsHint }}</p>
    <div class="cards">
      @for (c of activity().cartes; track $index; let i = $index) {
        <button
          type="button"
          class="flip"
          [class.back]="flipped().has(i)"
          [attr.aria-pressed]="flipped().has(i)"
          [attr.aria-label]="
            labels.cardLabel(i + 1, flipped().has(i) ? labels.answer_ : labels.question_)
          "
          (click)="flip(i)"
        >
          <span class="side" aria-hidden="true">{{
            flipped().has(i) ? labels.answer_ : labels.question_
          }}</span>
          <app-md
            [text]="flipped().has(i) ? c.verso : c.recto"
            [inline]="true"
            [glossary]="ctx().glossary"
          />
        </button>
      }
    </div>
    <p class="visually-hidden" aria-live="polite">{{ announce() }}</p>
    <app-complete-button [ctx]="ctx()" (progressed)="progressed.emit($event)" />
  `,
  styleUrl: './activities.scss',
})
export class Cards {
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  /** Cartes retournées (face réponse). */
  protected readonly flipped = signal(new Set<number>());
  protected readonly announce = signal('');
  protected readonly activity = computed(() => this.ctx().activity as ActivityOf<'fiches'>);

  protected flip(i: number): void {
    const next = new Set(this.flipped());
    if (next.has(i)) next.delete(i);
    else next.add(i);
    this.flipped.set(next);
    const card = this.activity().cartes[i]!;
    this.announce.set(next.has(i) ? card.verso : card.recto);
  }
}
