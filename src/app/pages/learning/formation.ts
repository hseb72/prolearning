import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LearnerFormationResponse, LearnerModule } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { READER_MODE } from '../../learning/reader-mode';
import { Md } from '../../learning/md';
import { LearnerProfileCard } from './profile';

/** Présentation d'un parcours et de ses modules, avec leur état pour l'apprenant. */
@Component({
  selector: 'app-learning-formation',
  imports: [RouterLink, Md, LearnerProfileCard],
  templateUrl: './formation.html',
  styleUrl: './learning.scss',
})
export class LearningFormationPage {
  private readonly auth = inject(AuthService);
  protected readonly mode = inject(READER_MODE);
  readonly formation = input.required<string>();
  protected readonly labels = LABELS.learning;
  protected readonly formations = LABELS.formations;

  protected readonly data = httpResource<LearnerFormationResponse>(() => {
    const me = this.auth.me();
    return me
      ? {
          url: `${this.mode.api}/${encodeURIComponent(this.formation())}`,
          params: { espace: me.space, compte: me.actor.id },
        }
      : undefined;
  });

  protected readonly modulesDone = computed(() => {
    const p = this.data.value()?.progression;
    return p ? Object.values(p.modules).filter((m) => m.termine).length : 0;
  });

  /** Activité où reprendre : la première pas encore faite, sinon la première. */
  protected resumeActivity(module: LearnerModule): string {
    const states = this.data.value()!.progression.activites[module.id] ?? {};
    const next = module.activites.find((a) => {
      const s = states[a.id]?.statut ?? 'a-faire';
      return s === 'a-faire' || s === 'echouee';
    });
    return (next ?? module.activites[0]!).id;
  }

  protected started(module: LearnerModule): boolean {
    const states = this.data.value()!.progression.activites[module.id] ?? {};
    return Object.values(states).some((s) => s.statut !== 'a-faire');
  }
}
