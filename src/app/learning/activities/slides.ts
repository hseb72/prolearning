import { Component, computed, input, output, signal } from '@angular/core';
import { LABELS } from '../../labels';
import { Md } from '../md';
import { References } from '../references';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';
import { CompleteButton } from './complete-button';

/** Diaporama commenté (§ 6.2) : une diapositive à la fois, navigation au clavier. */
@Component({
  selector: 'app-slides',
  imports: [Md, References, CompleteButton],
  template: `
    @if (slide(); as s) {
      <section class="slide" aria-live="polite">
        <p class="hint">{{ labels.slide(index() + 1, count()) }}</p>
        @if (s.titre) {
          <h3>{{ s.titre }}</h3>
        }
        <p class="image-absente">{{ labels.imageMissing(s.alt) }}</p>
        <app-md [text]="s.explication" [glossary]="ctx().glossary" />
        @if (s.approfondir; as a) {
          <details class="approfondir">
            <summary>{{ labels.goFurther }} : {{ a.titre }}</summary>
            <app-md [text]="a.markdown" [glossary]="ctx().glossary" />
            @if (a.references?.length) {
              <app-references [ids]="a.references!" [all]="ctx().references" />
            }
          </details>
        }
      </section>
      <div class="pager">
        <button
          class="button"
          type="button"
          [disabled]="index() === 0"
          (click)="index.set(index() - 1)"
        >
          {{ labels.previousSlide }}
        </button>
        <button
          class="button"
          type="button"
          [disabled]="index() === count() - 1"
          (click)="index.set(index() + 1)"
        >
          {{ labels.nextSlide }}
        </button>
      </div>
    }
    @if (index() === count() - 1) {
      <app-complete-button [ctx]="ctx()" (progressed)="progressed.emit($event)" />
    }
  `,
  styleUrl: './activities.scss',
})
export class Slides {
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  protected readonly index = signal(0);
  private readonly activity = computed(() => this.ctx().activity as ActivityOf<'diaporama'>);
  protected readonly count = computed(() => this.activity().diapos.length);
  protected readonly slide = computed(() => this.activity().diapos[this.index()]);
}
