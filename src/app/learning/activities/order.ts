import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import type { ExerciseCorrection } from '@shared/learning';
import { LABELS } from '../../labels';
import { LearningService } from '../learning.service';
import { Md } from '../md';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';

/**
 * Remettre dans l'ordre (§ 6.4). Alternative clavier exigée (CLAUDE.md) : chaque élément a
 * ses boutons « monter » et « descendre » ; c'est même le seul mode, accessible partout.
 */
@Component({
  selector: 'app-order',
  imports: [Md],
  template: `
    <app-md [text]="activity().consigne" [glossary]="ctx().glossary" />
    <ol class="order-list">
      @for (item of items(); track item.cle; let i = $index, first = $first, last = $last) {
        <li class="order-item">
          <span class="order-text"
            ><app-md [text]="item.texte" [inline]="true" [glossary]="ctx().glossary"
          /></span>
          <span class="visually-hidden">{{ labels.position(i + 1, items().length) }}</span>
          <span class="order-buttons">
            <button
              class="button"
              type="button"
              [disabled]="first"
              [attr.aria-label]="labels.moveUp(item.texte)"
              (click)="move(i, -1)"
            >
              ↑
            </button>
            <button
              class="button"
              type="button"
              [disabled]="last"
              [attr.aria-label]="labels.moveDown(item.texte)"
              (click)="move(i, 1)"
            >
              ↓
            </button>
          </span>
        </li>
      }
    </ol>
    <p class="visually-hidden" aria-live="polite">{{ announcement() }}</p>
    <button class="button primary" type="button" [disabled]="busy()" (click)="check()">
      {{ correction() ? labels.retry : labels.check }}
    </button>
    <div aria-live="polite">
      @if (error()) {
        <p class="message error" role="alert">{{ labels.failed }}</p>
      }
      @if (correction(); as c) {
        <div class="message" [class.success]="c.juste" [class.error]="!c.juste">
          <p>
            <strong>{{ c.juste ? labels.orderRight : labels.orderWrong }}</strong>
            @if (c.juste && c.etat.points) {
              {{ labels.earned(c.etat.points) }}
            }
          </p>
          @if (!c.juste) {
            <ol>
              @for (text of solutionTexts(); track $index) {
                <li>{{ text }}</li>
              }
            </ol>
          }
          <app-md [text]="c.explication" [glossary]="ctx().glossary" />
        </div>
      }
    </div>
  `,
  styleUrl: './activities.scss',
})
export class Order {
  private readonly service = inject(LearningService);
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  protected readonly activity = computed(() => this.ctx().activity as ActivityOf<'ordre'>);
  protected readonly items = signal<{ cle: string; texte: string }[]>([]);
  protected readonly correction = signal<ExerciseCorrection | null>(null);
  protected readonly announcement = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal(false);

  constructor() {
    effect(() => this.items.set([...this.activity().elements]));
  }

  protected move(index: number, delta: number): void {
    const list = [...this.items()];
    const [item] = list.splice(index, 1);
    list.splice(index + delta, 0, item!);
    this.items.set(list);
    this.announcement.set(
      `${item!.texte} : ${this.labels.position(index + delta + 1, list.length)}`,
    );
  }

  protected solutionTexts(): string[] {
    const solution = (this.correction()?.solution ?? []) as string[];
    return solution.map((cle) => this.activity().elements.find((e) => e.cle === cle)?.texte ?? cle);
  }

  protected async check(): Promise<void> {
    const c = this.ctx();
    this.busy.set(true);
    this.error.set(false);
    try {
      const correction = await this.service.checkOrder(
        c.formationId,
        c.moduleId,
        c.activity.id,
        this.items().map((i) => i.cle),
      );
      this.correction.set(correction);
      this.progressed.emit({ etat: correction.etat, moduleTermine: correction.moduleTermine });
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
