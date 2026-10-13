import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { ScenarioStep } from '@shared/learning';
import { LABELS } from '../../labels';
import { QuizOption } from '../../ui/quiz-option';
import { LearningService } from '../learning.service';
import { Md } from '../md';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';

/** Cas pratique à embranchements (§ 6.6), rejoué par l'API à chaque choix. */
@Component({
  selector: 'app-scenario',
  imports: [Md, QuizOption],
  template: `
    @if (step()?.fin; as fin) {
      <section class="result" aria-live="polite">
        <div class="stars" role="img" [attr.aria-label]="labels.stars(fin.etoiles)">
          @for (n of [1, 2, 3]; track n) {
            <span [class.off]="n > fin.etoiles" aria-hidden="true">★</span>
          }
        </div>
        <p class="muted">{{ labels.stars(fin.etoiles) }}</p>
        <app-md [text]="fin.message" [glossary]="ctx().glossary" />
        @if (fin.etat.points) {
          <div class="pop">{{ labels.xpEarned(fin.etat.points) }}</div>
        }
      </section>
      @for (entry of history(); track $index) {
        <div class="fb recap">
          <strong>{{ entry.choix }}</strong>
          @if (entry.retour) {
            <app-md [text]="entry.retour" [glossary]="ctx().glossary" />
          }
        </div>
      }
      <div class="acts">
        <button class="btn ghost" type="button" [disabled]="busy()" (click)="restart()">
          {{ labels.scenarioRestart }}
        </button>
      </div>
    } @else if (step(); as st) {
      <p class="meta">{{ labels.decision(history().length + (pending() ? 0 : 1)) }}</p>
      @if (pending(); as p) {
        <div class="scene">
          <app-md [text]="p.texte" [glossary]="ctx().glossary" />
        </div>
        <div class="opts">
          @for (choice of p.choix; track $index; let i = $index) {
            <button
              appQuizOption
              type="button"
              disabled
              [letter]="letters[i] ?? ''"
              [class.sel]="i === p.chosen"
            >
              <app-md [text]="choice" [inline]="true" [glossary]="ctx().glossary" />
            </button>
          }
        </div>
        <div class="fb" aria-live="polite">
          <strong>{{ labels.feedback }}</strong>
          <app-md [text]="st.retour ?? ''" [glossary]="ctx().glossary" />
        </div>
        <div class="acts end">
          <button class="btn" type="button" (click)="pending.set(null)">
            {{ labels.nextStep }}
          </button>
        </div>
      } @else if (st.noeud; as node) {
        <div class="scene">
          <app-md [text]="node.texte" [glossary]="ctx().glossary" />
        </div>
        <div class="opts">
          @for (choice of node.choix; track $index; let i = $index) {
            <button
              appQuizOption
              type="button"
              [letter]="letters[i] ?? ''"
              [disabled]="busy()"
              (click)="choose(i, choice, node)"
            >
              <app-md [text]="choice" [inline]="true" [glossary]="ctx().glossary" />
            </button>
          }
        </div>
      }
    } @else {
      <app-md [text]="activity().contexte" [glossary]="ctx().glossary" />
      <div class="acts end">
        <button class="btn" type="button" [disabled]="busy()" (click)="play([])">
          {{ labels.scenarioStart }}
        </button>
      </div>
    }
    <div aria-live="polite">
      @if (error()) {
        <p class="fb bad" role="alert">{{ labels.failed }}</p>
      }
    </div>
  `,
  styleUrl: './activities.scss',
})
export class Scenario {
  private readonly service = inject(LearningService);
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  protected readonly activity = computed(() => this.ctx().activity as ActivityOf<'scenario'>);
  protected readonly step = signal<ScenarioStep | null>(null);
  protected readonly history = signal<{ choix: string; retour?: string }[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  private path: number[] = [];
  protected readonly letters = 'ABCDEFGH';
  /** Situation qu'on vient de jouer, affichée avec le retour du choix avant de passer à la suite. */
  protected readonly pending = signal<{ texte: string; choix: string[]; chosen: number } | null>(
    null,
  );

  protected async choose(
    index: number,
    text: string,
    node: { texte: string; choix: string[] },
  ): Promise<void> {
    const step = await this.play([...this.path, index]);
    if (!step) return;
    this.history.update((h) => [...h, { choix: text, retour: step.retour }]);
    // À la fin du cas, le bilan reprend tous les retours ; sinon on montre celui-ci d'abord.
    if (!step.fin && step.retour) this.pending.set({ ...node, chosen: index });
  }

  protected restart(): void {
    this.path = [];
    this.history.set([]);
    this.pending.set(null);
    this.step.set(null);
  }

  protected async play(path: number[]): Promise<ScenarioStep | null> {
    const c = this.ctx();
    this.busy.set(true);
    this.error.set(false);
    try {
      const step = await this.service.scenario(c.formationId, c.moduleId, c.activity.id, path);
      this.path = path;
      this.step.set(step);
      if (step.fin)
        this.progressed.emit({ etat: step.fin.etat, moduleTermine: step.fin.moduleTermine });
      return step;
    } catch {
      this.error.set(true);
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
