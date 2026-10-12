import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LearnerFormationResponse, LearnerModule } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { READER_MODE } from '../../learning/reader-mode';
import { Md } from '../../learning/md';
import { ModuleTile, type TileState } from '../../ui/module-tile';
import { Stat } from '../../ui/stat';
import { LearnerProfileCard } from './profile';

/** Présentation d'un parcours et de ses modules, avec leur état pour l'apprenant. */
@Component({
  selector: 'app-learning-formation',
  imports: [RouterLink, Md, LearnerProfileCard, ModuleTile, Stat],
  templateUrl: './formation.html',
  styles: `
    .crumbs {
      font-size: 14px;
    }
    .subtitle {
      font-family: var(--display);
      font-size: 19px;
      color: var(--ink);
      margin-bottom: 4px;
    }
    .map {
      margin-bottom: 24px;
    }
    .about {
      margin-top: 24px;

      summary {
        cursor: pointer;
        font-weight: 600;
      }
      h2 {
        font-size: 19px;
        margin-top: 16px;
      }
      h3 {
        font-size: 15px;
        margin: 14px 0 4px;
      }
    }
    .glossary dt {
      font-weight: 600;
    }
    .glossary dd {
      margin: 0 0 8px;
    }
  `,
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

  /** État de la tuile : terminé, prochain à suivre, ouvert, ou verrouillé. */
  protected tileState(module: LearnerModule, index: number): TileState {
    const d = this.data.value()!;
    const state = d.progression.modules[module.id]!;
    if (state.termine) return 'done';
    if (!state.debloque) return 'locked';
    const first = d.formation.modules.findIndex(
      (m) => !d.progression.modules[m.id]!.termine && d.progression.modules[m.id]!.debloque,
    );
    return first === index ? 'next' : '';
  }

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
