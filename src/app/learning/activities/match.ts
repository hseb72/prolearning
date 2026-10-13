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
      <div class="assoc">
        @for (g of activity().gauches; track g.cle) {
          <div class="r" [class.ok]="verdict(g.cle) === true" [class.ko]="verdict(g.cle) === false">
            <label [for]="'m-' + g.cle"
              ><app-md [text]="g.texte" [inline]="true" [glossary]="ctx().glossary"
            /></label>
            <select
              class="inp"
              [id]="'m-' + g.cle"
              [attr.aria-label]="labels.matchFor(g.texte)"
              (change)="choose(g.cle, $any($event.target).value)"
            >
              <option value="">{{ labels.choose }}</option>
              @for (d of activity().droites; track $index) {
                <option [value]="d" [selected]="answers()[g.cle] === d">{{ d }}</option>
              }
            </select>
            @if (verdict(g.cle) === false) {
              <span class="small expected">{{ labels.expected }} {{ solution()[g.cle] }}</span>
            }
          </div>
        }
      </div>
      <div aria-live="polite">
        @if (error()) {
          <p class="fb bad" role="alert">{{ labels.failed }}</p>
        }
        @if (correction(); as c) {
          <div class="fb" [class.good]="c.juste" [class.bad]="!c.juste">
            <strong>{{ c.juste ? labels.matchRight : labels.matchScore(score(), total()) }}</strong>
            @if (c.juste && c.etat.points) {
              <span>{{ labels.earned(c.etat.points) }}</span>
            } @else if (!c.juste) {
              <span>{{ labels.matchFix }}</span>
            }
            <app-md [text]="c.explication" [glossary]="ctx().glossary" />
          </div>
        }
      </div>
      <div class="acts end">
        <button class="btn" type="submit" [disabled]="busy()">{{ labels.check }}</button>
      </div>
    </form>
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
  protected readonly answers = signal<Record<string, string>>({});
  /** Réponses au moment de la dernière vérification (les lignes ne changent de couleur qu'à la vérification). */
  private readonly checked = signal<Record<string, string>>({});
  protected readonly total = computed(() => this.activity().gauches.length);
  protected readonly score = computed(
    () => this.activity().gauches.filter((g) => this.verdict(g.cle) === true).length,
  );

  protected choose(cle: string, value: string): void {
    this.answers.update((a) => ({ ...a, [cle]: value }));
  }

  /** Juste, faux, ou pas encore vérifié. */
  protected verdict(cle: string): boolean | null {
    if (!this.correction()) return null;
    return this.checked()[cle] === this.solution()[cle];
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
        this.answers(),
      );
      this.checked.set({ ...this.answers() });
      this.correction.set(correction);
      this.progressed.emit({ etat: correction.etat, moduleTermine: correction.moduleTermine });
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
