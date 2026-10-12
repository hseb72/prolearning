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
    @if (card(); as c) {
      <div class="flashcard" aria-live="polite">
        <p class="hint">
          {{ labels.card(index() + 1, count()) }} · {{ flipped() ? labels.back : labels.front }}
        </p>
        <app-md [text]="flipped() ? c.verso : c.recto" [glossary]="ctx().glossary" />
      </div>
      <div class="pager">
        <button class="button" type="button" [disabled]="index() === 0" (click)="go(-1)">
          {{ labels.previousCard }}
        </button>
        <button
          class="button primary"
          type="button"
          [attr.aria-pressed]="flipped()"
          (click)="flipped.set(!flipped())"
        >
          {{ labels.flip }}
        </button>
        <button class="button" type="button" [disabled]="index() === count() - 1" (click)="go(1)">
          {{ labels.nextCard }}
        </button>
      </div>
    }
    @if (index() === count() - 1) {
      <app-complete-button [ctx]="ctx()" (progressed)="progressed.emit($event)" />
    }
  `,
  styleUrl: './activities.scss',
})
export class Cards {
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  protected readonly index = signal(0);
  protected readonly flipped = signal(false);
  private readonly activity = computed(() => this.ctx().activity as ActivityOf<'fiches'>);
  protected readonly count = computed(() => this.activity().cartes.length);
  protected readonly card = computed(() => this.activity().cartes[this.index()]);

  protected go(delta: number): void {
    this.index.update((i) => i + delta);
    this.flipped.set(false);
  }
}
