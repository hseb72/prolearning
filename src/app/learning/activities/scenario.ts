import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { ScenarioStep } from '@shared/learning';
import { LABELS } from '../../labels';
import { LearningService } from '../learning.service';
import { Md } from '../md';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';

/** Cas pratique à embranchements (§ 6.6), rejoué par l'API à chaque choix. */
@Component({
  selector: 'app-scenario',
  imports: [Md],
  template: `
    <app-md [text]="activity().contexte" [glossary]="ctx().glossary" />

    @if (!step()) {
      <button class="button primary" type="button" [disabled]="busy()" (click)="play([])">
        {{ labels.scenarioStart }}
      </button>
    }

    <div aria-live="polite">
      @for (entry of history(); track $index) {
        <div class="scenario-entry">
          <p class="hint">{{ labels.yourChoice }} : {{ entry.choix }}</p>
          @if (entry.retour) {
            <div class="retour">
              <p class="hint">{{ labels.feedback }}</p>
              <app-md [text]="entry.retour" [glossary]="ctx().glossary" />
            </div>
          }
        </div>
      }
      @if (step()?.noeud; as node) {
        <div class="scenario-node">
          <app-md [text]="node.texte" [glossary]="ctx().glossary" />
          <div class="choices">
            @for (choice of node.choix; track $index; let i = $index) {
              <button class="button" type="button" [disabled]="busy()" (click)="choose(i, choice)">
                <app-md [text]="choice" [inline]="true" [glossary]="ctx().glossary" />
              </button>
            }
          </div>
        </div>
      }
      @if (step()?.fin; as fin) {
        <div class="message success">
          <p class="stars" [attr.aria-label]="labels.stars(fin.etoiles)">
            <span aria-hidden="true"
              >{{ '★'.repeat(fin.etoiles) }}{{ '☆'.repeat(3 - fin.etoiles) }}</span
            >
            {{ labels.stars(fin.etoiles) }} · {{ labels.earned(fin.etat.points) }}
          </p>
          <app-md [text]="fin.message" [glossary]="ctx().glossary" />
        </div>
        <button class="button" type="button" [disabled]="busy()" (click)="restart()">
          {{ labels.scenarioRestart }}
        </button>
      }
      @if (error()) {
        <p class="message error" role="alert">{{ labels.failed }}</p>
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

  protected async choose(index: number, text: string): Promise<void> {
    const step = await this.play([...this.path, index]);
    if (step) this.history.update((h) => [...h, { choix: text, retour: step.retour }]);
  }

  protected restart(): void {
    this.path = [];
    this.history.set([]);
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
