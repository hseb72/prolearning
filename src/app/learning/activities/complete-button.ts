import { Component, inject, input, output, signal } from '@angular/core';
import { LABELS } from '../../labels';
import { LearningService } from '../learning.service';
import type { ActivityContext, ActivityProgress } from './activity-context';

/** « J'ai lu, continuer » : pour les leçons, diaporamas et fiches. */
@Component({
  selector: 'app-complete-button',
  template: `
    <div aria-live="polite">
      @if (error()) {
        <p class="fb bad" role="alert">{{ labels.failed }}</p>
      }
    </div>
    <div class="acts end">
      <button class="btn" type="button" [disabled]="busy()" (click)="complete()">
        {{ labels.markDone }}
      </button>
    </div>
  `,
  styles: `
    .end {
      justify-content: flex-end;
    }
  `,
})
export class CompleteButton {
  private readonly service = inject(LearningService);
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  protected readonly busy = signal(false);
  protected readonly error = signal(false);

  protected async complete(): Promise<void> {
    const c = this.ctx();
    this.busy.set(true);
    this.error.set(false);
    try {
      this.progressed.emit(await this.service.complete(c.formationId, c.moduleId, c.activity.id));
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
