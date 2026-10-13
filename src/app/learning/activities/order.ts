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
    <p class="small muted">{{ labels.orderHint }}</p>
    <p class="visually-hidden" aria-live="polite">{{ announcement() }}</p>
    <ol class="order">
      @for (item of items(); track item.cle; let i = $index, first = $first, last = $last) {
        <li
          draggable="true"
          [class.ok]="placed(i) === true"
          [class.ko]="placed(i) === false"
          [class.drag]="dragging() === i"
          [class.over]="over() === i && dragging() !== i"
          (dragstart)="dragStart($event, i)"
          (dragover)="dragOver($event, i)"
          (dragleave)="over.set(null)"
          (drop)="drop($event, i)"
          (dragend)="dragging.set(null); over.set(null)"
        >
          <span class="grip" aria-hidden="true">⋮⋮</span>
          <span class="lab order-text"
            ><app-md [text]="item.texte" [inline]="true" [glossary]="ctx().glossary"
          /></span>
          <span class="visually-hidden">{{ labels.position(i + 1, items().length) }}</span>
          <button
            class="mv"
            type="button"
            [disabled]="first"
            [attr.aria-label]="labels.moveUp(item.texte)"
            (click)="move(i, -1)"
          >
            ↑
          </button>
          <button
            class="mv"
            type="button"
            [disabled]="last"
            [attr.aria-label]="labels.moveDown(item.texte)"
            (click)="move(i, 1)"
          >
            ↓
          </button>
        </li>
      }
    </ol>
    <div aria-live="polite">
      @if (error()) {
        <p class="fb bad" role="alert">{{ labels.failed }}</p>
      }
      @if (correction(); as c) {
        <div class="fb" [class.good]="c.juste" [class.bad]="!c.juste">
          <strong>{{
            c.juste ? labels.orderRight : labels.orderScore(score(), items().length)
          }}</strong>
          @if (c.juste && c.etat.points) {
            <span>{{ labels.earned(c.etat.points) }}</span>
          } @else if (!c.juste) {
            <span>{{ labels.orderFix }}</span>
          }
          <app-md [text]="c.explication" [glossary]="ctx().glossary" />
        </div>
      }
    </div>
    <div class="acts end">
      <button class="btn" type="button" [disabled]="busy()" (click)="check()">
        {{ labels.check }}
      </button>
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
  protected readonly dragging = signal<number | null>(null);
  protected readonly over = signal<number | null>(null);
  /** Ordre au moment de la dernière vérification. */
  private readonly checked = signal<string[]>([]);
  protected readonly score = computed(
    () => this.items().filter((_, i) => this.placed(i) === true).length,
  );
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

  /** Bien placé, mal placé, ou pas encore vérifié (tant que l'ordre n'a pas bougé). */
  protected placed(index: number): boolean | null {
    const solution = this.correction()?.solution as string[] | undefined;
    const keys = this.items().map((i) => i.cle);
    if (!solution || keys.join() !== this.checked().join()) return null;
    return keys[index] === solution[index];
  }

  protected dragStart(event: DragEvent, index: number): void {
    this.dragging.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
  }

  protected dragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    this.over.set(index);
  }

  protected drop(event: DragEvent, index: number): void {
    event.preventDefault();
    const from = this.dragging();
    this.dragging.set(null);
    this.over.set(null);
    if (from === null || from === index) return;
    const list = [...this.items()];
    const [item] = list.splice(from, 1);
    list.splice(index, 0, item!);
    this.items.set(list);
    this.announcement.set(`${item!.texte} : ${this.labels.position(index + 1, list.length)}`);
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
      this.checked.set(this.items().map((i) => i.cle));
      this.correction.set(correction);
      this.progressed.emit({ etat: correction.etat, moduleTermine: correction.moduleTermine });
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
