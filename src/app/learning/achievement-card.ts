import { Component, computed, input } from '@angular/core';
import { BADGES } from '@shared/gamification';
import type { SharedAchievement } from '@shared/learning';
import { LABELS } from '../labels';
import { ProgressBar } from '../ui/progress';

/** Réussite publiée (décision 5) : personne, parcours, modules terminés, niveau, badges. */
@Component({
  selector: 'app-achievement-card',
  imports: [ProgressBar],
  host: { class: 'card achievement' },
  template: `
    <p class="eyebrow muted">{{ item().formationTitre }}</p>
    <h3>{{ item().personne }}</h3>
    <p class="small">
      @if (item().termine) {
        <strong class="done">{{ labels.finished }}</strong> ·
      }
      {{ labels.modules(item().modulesTermines, item().modulesTotal) }} ·
      {{ labels.level(item().niveau) }}
    </p>
    <app-progress-bar
      [value]="(100 * item().modulesTermines) / item().modulesTotal"
      [label]="labels.modules(item().modulesTermines, item().modulesTotal)"
    />
    <p class="small muted badges-line">
      @if (badgeNames().length) {
        {{ labels.badges }} : {{ badgeNames().join(', ') }}
      } @else {
        {{ labels.noBadge }}
      }
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
    }
    h3,
    p {
      margin: 0;
    }
    .eyebrow.muted {
      color: var(--muted);
    }
    .done {
      color: var(--good);
    }
  `,
})
export class AchievementCard {
  readonly item = input.required<SharedAchievement>();
  protected readonly labels = LABELS.shares;
  protected readonly badgeNames = computed(() => this.item().badges.map((b) => BADGES[b].nom));
}
