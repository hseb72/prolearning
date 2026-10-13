import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { QuizAttempt, QuizCorrection } from '@shared/learning';
import { LABELS } from '../../labels';
import { Deepen } from '../../ui/deepen';
import { ProgressBar } from '../../ui/progress';
import { QuizOption } from '../../ui/quiz-option';
import { LearningService } from '../learning.service';
import { Md } from '../md';
import { References } from '../references';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';

/**
 * Quiz (§ 6.3) : questions tirées par l'API, une à la fois (décision A) ; toutes les réponses
 * partent ensemble à l'API, qui corrige. Score et corrections sur l'écran de résultat.
 */
@Component({
  selector: 'app-quiz',
  imports: [Md, References, Deepen, ProgressBar, QuizOption],
  template: `
    @if (attempt(); as a) {
      @let q = a.questions[index()]!;
      <div class="meta">
        <span>{{ labels.questionShort(index() + 1, a.questions.length) }}</span>
        @if (q.type === 'choix_multiple') {
          <span>{{ labels.multipleShort }}</span>
        }
      </div>
      <app-progress-bar
        class="quiz-bar"
        [value]="(index() / a.questions.length) * 100"
        [label]="labels.question(index() + 1, a.questions.length)"
      />
      <form (submit)="nextQuestion($event)">
        <fieldset class="question" [attr.data-question]="q.id">
          <legend class="q"><app-md [text]="q.enonce" [glossary]="ctx().glossary" /></legend>
          @if (q.type === 'choix_multiple') {
            <p class="small muted">{{ labels.multiple }}</p>
          }
          <div class="opts">
            @for (o of q.options; track o.id; let j = $index) {
              <label appQuizOption [letter]="letters[j] ?? ''">
                <input
                  class="visually-hidden"
                  [type]="q.type === 'choix_multiple' ? 'checkbox' : 'radio'"
                  [name]="q.id"
                  [value]="o.id"
                  [checked]="chosen(q.id, o.id)"
                  (change)="
                    toggle(q.id, o.id, q.type === 'choix_multiple', $any($event.target).checked)
                  "
                />
                <app-md [text]="o.texte" [inline]="true" [glossary]="ctx().glossary" />
              </label>
            }
          </div>
          @if (q.indice) {
            <app-deepen class="hint" [heading]="labels.hint" [tag]="labels.hint">
              <app-md [text]="q.indice" [glossary]="ctx().glossary" />
            </app-deepen>
          }
        </fieldset>
        <div class="acts end">
          @if (index() > 0) {
            <button class="btn ghost" type="button" (click)="index.set(index() - 1)">
              {{ labels.previousQuestion }}
            </button>
          }
          <button class="btn" type="submit" [disabled]="busy() || !answered(q.id)">
            {{ index() + 1 < a.questions.length ? labels.nextQuestion : labels.quizSubmit }}
          </button>
        </div>
      </form>
    } @else if (correction(); as c) {
      <section class="result" aria-live="polite">
        <p class="eyebrow">{{ c.reussi ? labels.quizPassed : labels.quizFailed }}</p>
        <div class="big">{{ c.bonnesReponses }}/{{ c.total }}</div>
        @if (c.reussi && c.etat.points) {
          <div class="pop">{{ labels.xpEarned(c.etat.points) }}</div>
        }
        <p class="muted">
          {{ labels.quizResult(c.bonnesReponses, c.total) }}
          {{ labels.threshold(needed(c), c.total) }}
        </p>
        <div class="acts center">
          <button class="btn ghost" type="button" [disabled]="busy()" (click)="start()">
            {{ labels.quizRetry }}
          </button>
        </div>
      </section>
      <h2 class="corrections">{{ labels.corrections }}</h2>
      @for (q of c.questions; track q.id; let i = $index) {
        <div class="fb" [class.good]="q.juste" [class.bad]="!q.juste">
          <strong
            >{{ labels.question(i + 1, c.questions.length) }} —
            {{ q.juste ? labels.correct : labels.incorrect }}</strong
          >
          <app-md class="small" [text]="questionText(q.id)" [glossary]="ctx().glossary" />
          @if (!q.juste) {
            <p>{{ labels.expected }} {{ optionTexts(q.id, q.bonnes) }}</p>
          }
          <app-md [text]="q.explication" [glossary]="ctx().glossary" />
          @if (q.references.length) {
            <app-references [ids]="q.references" [all]="ctx().references" />
          }
        </div>
      }
    } @else {
      <p>{{ labels.quizIntro(activity().questionsParTentative, activity().seuil) }}</p>
      <div class="acts end">
        <button class="btn" type="button" [disabled]="busy()" (click)="start()">
          {{ labels.quizStart }}
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
export class Quiz {
  private readonly service = inject(LearningService);
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  protected readonly activity = computed(() => this.ctx().activity as ActivityOf<'quiz'>);
  protected readonly attempt = signal<QuizAttempt | null>(null);
  protected readonly correction = signal<QuizCorrection | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  /** Question affichée. */
  protected readonly index = signal(0);
  protected readonly letters = 'ABCDEFGH';
  private readonly answers = signal<Record<string, string[]>>({});
  /** Questions de la dernière tentative, pour afficher le texte des réponses attendues. */
  private lastQuestions: QuizAttempt['questions'] = [];

  protected async start(): Promise<void> {
    const c = this.ctx();
    await this.run(async () => {
      const attempt = await this.service.startQuiz(c.formationId, c.moduleId, c.activity.id);
      // Chaque question tirée figure dans les réponses, même laissée sans réponse.
      this.answers.set(Object.fromEntries(attempt.questions.map((q) => [q.id, []])));
      this.lastQuestions = attempt.questions;
      this.correction.set(null);
      this.index.set(0);
      this.attempt.set(attempt);
    });
  }

  protected toggle(question: string, option: string, multiple: boolean, checked: boolean): void {
    const current = this.answers()[question] ?? [];
    const next = multiple
      ? checked
        ? [...current, option]
        : current.filter((o) => o !== option)
      : [option];
    this.answers.update((a) => ({ ...a, [question]: next }));
  }

  protected chosen(question: string, option: string): boolean {
    return (this.answers()[question] ?? []).includes(option);
  }

  protected answered(question: string): boolean {
    return (this.answers()[question] ?? []).length > 0;
  }

  /** Question suivante, ou envoi de toutes les réponses après la dernière. */
  protected async nextQuestion(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const attempt = this.attempt();
    if (!attempt) return;
    if (this.index() + 1 < attempt.questions.length) {
      this.index.update((i) => i + 1);
      return;
    }
    const c = this.ctx();
    await this.run(async () => {
      const correction = await this.service.answerQuiz(
        c.formationId,
        c.moduleId,
        c.activity.id,
        attempt.tentative,
        this.answers(),
      );
      this.correction.set(correction);
      this.attempt.set(null);
      this.progressed.emit({ etat: correction.etat, moduleTermine: correction.moduleTermine });
    });
  }

  /** Nombre de bonnes réponses qu'il fallait pour réussir. */
  protected needed(c: QuizCorrection): number {
    return Math.ceil(c.seuil * c.total - 1e-9);
  }

  protected questionText(id: string): string {
    return this.lastQuestions.find((q) => q.id === id)?.enonce ?? '';
  }

  protected optionTexts(question: string, ids: string[]): string {
    const options = this.lastQuestions.find((q) => q.id === question)?.options ?? [];
    return ids.map((id) => options.find((o) => o.id === id)?.texte ?? id).join(' ; ');
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(false);
    try {
      await action();
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
