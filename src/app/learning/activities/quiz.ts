import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { QuizAttempt, QuizCorrection } from '@shared/learning';
import { LABELS } from '../../labels';
import { LearningService } from '../learning.service';
import { Md } from '../md';
import { References } from '../references';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';

/** Quiz (§ 6.3) : questions tirées par l'API, corrigées par l'API, explications après réponse. */
@Component({
  selector: 'app-quiz',
  imports: [Md, References],
  template: `
    <p>{{ labels.quizIntro(activity().questionsParTentative, activity().seuil) }}</p>

    @if (!attempt()) {
      <button class="button primary" type="button" [disabled]="busy()" (click)="start()">
        {{ correction() ? labels.quizRetry : labels.quizStart }}
      </button>
    } @else {
      <form (submit)="submit($event)">
        @for (q of attempt()!.questions; track q.id; let i = $index) {
          <fieldset class="question" [attr.data-question]="q.id">
            <legend>
              <span class="hint">{{ labels.question(i + 1, attempt()!.questions.length) }}</span>
              <app-md [text]="q.enonce" [glossary]="ctx().glossary" />
            </legend>
            @if (q.type === 'choix_multiple') {
              <p class="hint">{{ labels.multiple }}</p>
            }
            @for (o of q.options; track o.id) {
              <div class="option">
                <input
                  [id]="q.id + '-' + o.id"
                  [type]="q.type === 'choix_multiple' ? 'checkbox' : 'radio'"
                  [name]="q.id"
                  [value]="o.id"
                  (change)="
                    toggle(q.id, o.id, q.type === 'choix_multiple', $any($event.target).checked)
                  "
                />
                <label [for]="q.id + '-' + o.id"
                  ><app-md [text]="o.texte" [inline]="true" [glossary]="ctx().glossary"
                /></label>
              </div>
            }
            @if (q.indice) {
              <details>
                <summary>{{ labels.hint }}</summary>
                <app-md [text]="q.indice" [glossary]="ctx().glossary" />
              </details>
            }
          </fieldset>
        }
        <button class="button primary" type="submit" [disabled]="busy()">
          {{ labels.quizSubmit }}
        </button>
      </form>
    }

    <div aria-live="polite">
      @if (error()) {
        <p class="message error" role="alert">{{ labels.failed }}</p>
      }
      @if (correction(); as c) {
        <section class="result" [class.success]="c.reussi">
          <p class="message" [class.success]="c.reussi" [class.error]="!c.reussi">
            <strong>{{ c.reussi ? labels.quizPassed : labels.quizFailed }}</strong>
            {{ labels.quizResult(c.bonnesReponses, c.total) }}
            @if (c.etat.points) {
              {{ labels.earned(c.etat.points) }}
            }
          </p>
          @for (q of c.questions; track q.id; let i = $index) {
            <div class="explanation" [class.ok]="q.juste">
              <p>
                <strong
                  >{{ labels.question(i + 1, c.questions.length) }} —
                  {{ q.juste ? labels.correct : labels.incorrect }}</strong
                >
              </p>
              @if (!q.juste) {
                <p>{{ labels.expected }} {{ optionTexts(q.id, q.bonnes) }}</p>
              }
              <app-md [text]="q.explication" [glossary]="ctx().glossary" />
              @if (q.references.length) {
                <app-references [ids]="q.references" [all]="ctx().references" />
              }
            </div>
          }
        </section>
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
  private answers: Record<string, string[]> = {};
  /** Questions de la dernière tentative, pour afficher le texte des réponses attendues. */
  private lastQuestions: QuizAttempt['questions'] = [];

  protected async start(): Promise<void> {
    const c = this.ctx();
    await this.run(async () => {
      this.answers = {};
      this.correction.set(null);
      const attempt = await this.service.startQuiz(c.formationId, c.moduleId, c.activity.id);
      this.lastQuestions = attempt.questions;
      this.attempt.set(attempt);
    });
  }

  protected toggle(question: string, option: string, multiple: boolean, checked: boolean): void {
    const current = this.answers[question] ?? [];
    this.answers[question] = multiple
      ? checked
        ? [...current, option]
        : current.filter((o) => o !== option)
      : [option];
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const c = this.ctx();
    const attempt = this.attempt();
    if (!attempt) return;
    await this.run(async () => {
      const correction = await this.service.answerQuiz(
        c.formationId,
        c.moduleId,
        c.activity.id,
        attempt.tentative,
        this.answers,
      );
      this.correction.set(correction);
      this.attempt.set(null);
      this.progressed.emit({ etat: correction.etat, moduleTermine: correction.moduleTermine });
    });
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
