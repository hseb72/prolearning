import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { ExerciseCorrection } from '@shared/learning';
import { LABELS } from '../../labels';
import { LearningService } from '../learning.service';
import { Md } from '../md';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';

/** Associer (§ 6.5) : une liste déroulante par élément de gauche, utilisable au clavier. */
@Component({
  selector: 'app-match',
  imports: [Md],
  template: `
    <app-md [text]="activity().consigne" [glossary]="ctx().glossary" />
    <form (submit)="check($event)">
      @for (g of activity().gauches; track g.cle) {
        <div class="match-row">
          <label [for]="'m-' + g.cle"
            ><app-md [text]="g.texte" [inline]="true" [glossary]="ctx().glossary"
          /></label>
          <select
            [id]="'m-' + g.cle"
            [attr.aria-label]="labels.matchFor(g.texte)"
            (change)="choose(g.cle, $any($event.target).value)"
          >
            <option value="">{{ labels.choose }}</option>
            @for (d of activity().droites; track $index) {
              <option [value]="d">{{ d }}</option>
            }
          </select>
          @if (correction(); as c) {
            <span class="match-result" [class.ok]="answers[g.cle] === solution()[g.cle]">
              {{
                answers[g.cle] === solution()[g.cle]
                  ? labels.correct
                  : labels.expected + ' ' + solution()[g.cle]
              }}
            </span>
          }
        </div>
      }
      <button class="button primary" type="submit" [disabled]="busy()">
        {{ correction() ? labels.retry : labels.check }}
      </button>
    </form>
    <div aria-live="polite">
      @if (error()) {
        <p class="message error" role="alert">{{ labels.failed }}</p>
      }
      @if (correction(); as c) {
        <div class="message" [class.success]="c.juste" [class.error]="!c.juste">
          <p>
            <strong>{{ c.juste ? labels.matchRight : labels.matchWrong }}</strong>
            @if (c.juste && c.etat.points) {
              {{ labels.earned(c.etat.points) }}
            }
          </p>
          <app-md [text]="c.explication" [glossary]="ctx().glossary" />
        </div>
      }
    </div>
  `,
  styleUrl: './activities.scss',
})
export class Match {
  private readonly service = inject(LearningService);
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  protected readonly activity = computed(() => this.ctx().activity as ActivityOf<'association'>);
  protected readonly correction = signal<ExerciseCorrection | null>(null);
  protected readonly solution = computed(
    () => (this.correction()?.solution ?? {}) as Record<string, string>,
  );
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  protected answers: Record<string, string> = {};

  protected choose(cle: string, value: string): void {
    this.answers = { ...this.answers, [cle]: value };
  }

  protected async check(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const c = this.ctx();
    this.busy.set(true);
    this.error.set(false);
    try {
      const correction = await this.service.checkMatches(
        c.formationId,
        c.moduleId,
        c.activity.id,
        this.answers,
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
