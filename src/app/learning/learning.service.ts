import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CompletionResult,
  ExerciseCorrection,
  QuizAttempt,
  QuizCorrection,
  ScenarioStep,
} from '@shared/learning';
import { firstValueFrom } from 'rxjs';
import { READER_MODE } from './reader-mode';

/** Exercices du lecteur : l'API corrige et tient la progression (sauf en aperçu). */
@Injectable({ providedIn: 'root' })
export class LearningService {
  private readonly http = inject(HttpClient);
  private readonly mode = inject(READER_MODE);

  private url(formation: string, module: string, activite: string, action: string): string {
    const e = encodeURIComponent;
    return `${this.mode.api}/${e(formation)}/modules/${e(module)}/activites/${e(activite)}/${action}`;
  }

  complete(f: string, m: string, a: string): Promise<CompletionResult> {
    return firstValueFrom(this.http.post<CompletionResult>(this.url(f, m, a, 'terminee'), {}));
  }

  startQuiz(f: string, m: string, a: string): Promise<QuizAttempt> {
    return firstValueFrom(this.http.post<QuizAttempt>(this.url(f, m, a, 'quiz/tentative'), {}));
  }

  answerQuiz(
    f: string,
    m: string,
    a: string,
    tentative: number,
    reponses: Record<string, string[]>,
  ) {
    return firstValueFrom(
      this.http.post<QuizCorrection>(this.url(f, m, a, 'quiz/reponses'), { tentative, reponses }),
    );
  }

  /** Travaux pratiques : terminés quand toute la vérification est cochée. */
  checkPractice(f: string, m: string, a: string, cochees: string[]): Promise<CompletionResult> {
    return firstValueFrom(
      this.http.post<CompletionResult>(this.url(f, m, a, 'pratique'), { cochees }),
    );
  }

  checkOrder(f: string, m: string, a: string, ordre: string[]) {
    return firstValueFrom(
      this.http.post<ExerciseCorrection>(this.url(f, m, a, 'ordre'), { ordre }),
    );
  }

  checkMatches(f: string, m: string, a: string, reponses: Record<string, string>) {
    return firstValueFrom(
      this.http.post<ExerciseCorrection>(this.url(f, m, a, 'association'), { reponses }),
    );
  }

  scenario(f: string, m: string, a: string, chemin: number[]) {
    return firstValueFrom(this.http.post<ScenarioStep>(this.url(f, m, a, 'scenario'), { chemin }));
  }
}
