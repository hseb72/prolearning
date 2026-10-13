import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { LearnerFormationResponse } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { READER_MODE } from '../../learning/reader-mode';
import type { ActivityContext, ActivityProgress } from '../../learning/activities/activity-context';
import { Cards } from '../../learning/activities/cards';
import { Lesson } from '../../learning/activities/lesson';
import { Match } from '../../learning/activities/match';
import { Order } from '../../learning/activities/order';
import { Practice } from '../../learning/activities/practice';
import { Quiz } from '../../learning/activities/quiz';
import { Scenario } from '../../learning/activities/scenario';
import { Slides } from '../../learning/activities/slides';

/** Une activité, avec la liste des activités du module et la navigation précédente/suivante. */
@Component({
  selector: 'app-learning-activity',
  imports: [RouterLink, Lesson, Slides, Quiz, Order, Match, Scenario, Cards, Practice],
  templateUrl: './activity.html',
  styles: `
    .act {
      min-width: 0;
    }
    h1 {
      font-size: clamp(22px, 3.4vw, 26px);
      margin: 4px 0 16px;
    }
    .pager {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }
    .ck.ko {
      border-color: var(--bad);
    }
  `,
})
export class LearningActivityPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly mode = inject(READER_MODE);
  readonly formation = input.required<string>();
  readonly module = input.required<string>();
  readonly activite = input.required<string>();
  protected readonly labels = LABELS.learning;
  protected readonly formations = LABELS.formations;
  protected readonly notice = signal<string | null>(null);

  constructor() {
    // Un message de fin de module ne suit pas l'apprenant d'une activité à l'autre.
    effect(() => {
      this.activite();
      untracked(() => this.notice.set(null));
    });
  }

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
    const moduleIndex = d?.formation.modules.findIndex((m) => m.id === this.module()) ?? -1;
    const module = d?.formation.modules[moduleIndex];
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
      moduleIndex,
      ctx,
      unlocked: d.progression.modules[module.id]?.debloque ?? false,
      states: d.progression.activites[module.id] ?? {},
      previous: module.activites[index - 1]?.id ?? null,
      next: module.activites[index + 1]?.id ?? null,
    };
  });

  /**
   * Résultat enregistré par l'API. Pour une leçon, un diaporama ou des fiches (« J'ai lu,
   * continuer »), on passe à l'activité suivante quand il y en a une.
   */
  protected onProgress(result: ActivityProgress, advance = false): void {
    this.notice.set(result.moduleTermine ? this.labels.moduleCompleted : null);
    const c = this.current();
    if (advance && c?.next && !result.moduleTermine) {
      void this.router.navigate([this.mode.route, c.formation.id, c.module.id, c.next]);
    }
    // L'état (statuts, déblocage, points) est recalculé par l'API : on relit.
    this.data.reload();
  }
}
