import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LearnerFormationResponse } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { READER_MODE } from '../../learning/reader-mode';
import type { ActivityContext, ActivityProgress } from '../../learning/activities/activity-context';
import { Cards } from '../../learning/activities/cards';
import { Lesson } from '../../learning/activities/lesson';
import { Match } from '../../learning/activities/match';
import { Order } from '../../learning/activities/order';
import { Quiz } from '../../learning/activities/quiz';
import { Scenario } from '../../learning/activities/scenario';
import { Slides } from '../../learning/activities/slides';

/** Une activité, avec la liste des activités du module et la navigation précédente/suivante. */
@Component({
  selector: 'app-learning-activity',
  imports: [RouterLink, Lesson, Slides, Quiz, Order, Match, Scenario, Cards],
  templateUrl: './activity.html',
  styleUrl: './learning.scss',
})
export class LearningActivityPage {
  private readonly auth = inject(AuthService);
  protected readonly mode = inject(READER_MODE);
  readonly formation = input.required<string>();
  readonly module = input.required<string>();
  readonly activite = input.required<string>();
  protected readonly labels = LABELS.learning;
  protected readonly formations = LABELS.formations;
  protected readonly notice = signal<string | null>(null);

  protected readonly data = httpResource<LearnerFormationResponse>(() => {
    const me = this.auth.me();
    return me
      ? {
          url: `${this.mode.api}/${encodeURIComponent(this.formation())}`,
          params: { espace: me.space, compte: me.actor.id },
        }
      : undefined;
  });

  protected readonly current = computed(() => {
    const d = this.data.value();
    const module = d?.formation.modules.find((m) => m.id === this.module());
    const index = module?.activites.findIndex((a) => a.id === this.activite()) ?? -1;
    if (!d || !module || index < 0) return null;
    const activity = module.activites[index]!;
    const ctx: ActivityContext = {
      formationId: d.formation.id,
      moduleId: module.id,
      activity,
      state: d.progression.activites[module.id]?.[activity.id] ?? {
        statut: 'a-faire',
        points: 0,
        score: null,
      },
      glossary: d.formation.glossaire,
      references: d.formation.references,
    };
    return {
      formation: d.formation,
      module,
      ctx,
      unlocked: d.progression.modules[module.id]?.debloque ?? false,
      states: d.progression.activites[module.id] ?? {},
      previous: module.activites[index - 1]?.id ?? null,
      next: module.activites[index + 1]?.id ?? null,
    };
  });

  protected onProgress(result: ActivityProgress): void {
    this.notice.set(result.moduleTermine ? this.labels.moduleCompleted : null);
    // L'état (statuts, déblocage, points) est recalculé par l'API : on relit.
    this.data.reload();
  }
}
