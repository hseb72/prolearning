import { Component, computed, input } from '@angular/core';
import { BADGES, type BadgeId } from '@shared/gamification';
import { LABELS } from '../labels';

/** Icônes du prototype, rapprochées des badges de la plateforme (décision B). */
const ICONS: Record<BadgeId, string> = {
  'premier-pas': 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  'module-termine': 'M4 20V5h10l-1.5 3L14 11H6v9z',
  'sans-faute': 'M5 12.5l4.5 4.5L19 7.5',
  stratege: 'M3 20h18M5 20V10l7-5 7 5v10M9 20v-5h6v5',
  'parcours-termine':
    'M7 4h10v4a5 5 0 01-10 0zM12 13v4M8 20h8M4 5h3v2a2 2 0 01-3 0zM17 5h3v2a2 2 0 01-3 0z',
};
/** Icônes dessinées au trait (sans remplissage). */
const STROKED: ReadonlySet<BadgeId> = new Set(['sans-faute', 'stratege']);

/** Badge (`.badge`) : icône orange, nom, description ; grisé tant qu'il n'est pas obtenu. */
@Component({
  selector: 'app-badge',
  host: { '[class]': 'earned() ? "badge" : "badge off"', '[attr.title]': 'badge().description' },
  template: `
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      [attr.fill]="stroked() ? 'none' : 'var(--accent-fill)'"
      stroke="var(--accent-fill)"
      [attr.stroke-width]="stroked() ? 2.4 : 1"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path [attr.d]="icon()" />
    </svg>
    <b>{{ badge().nom }}</b>
    <span class="muted">{{ badge().description }}</span>
    <span class="visually-hidden">({{ earned() ? labels.badgeEarned : labels.badgeLocked }})</span>
  `,
})
export class Badge {
  readonly id = input.required<BadgeId>();
  readonly earned = input(false);
  protected readonly labels = LABELS.ui;
  protected readonly badge = computed(() => BADGES[this.id()]);
  protected readonly icon = computed(() => ICONS[this.id()]);
  protected readonly stroked = computed(() => STROKED.has(this.id()));
}
