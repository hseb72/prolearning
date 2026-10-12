import { Component, computed, input } from '@angular/core';
import { TIME_ZONE, type Modalite } from '@shared/catalog';
import { LABELS } from '../labels';
import { Tag } from './tag';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, day: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, month: 'short' });
const fullFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Ligne de session (`.session`) : bloc date, titre, pastilles, jauge de places, et l'action
 * en contenu (bouton « Demander l'inscription », « Demande envoyée »…).
 */
@Component({
  selector: 'app-session-row',
  imports: [Tag],
  host: { class: 'card session' },
  template: `
    <div class="date" aria-hidden="true">
      <b>{{ day() }}</b
      ><span>{{ month() }}</span>
    </div>
    <div>
      <h3>
        <span class="visually-hidden">{{ fullDate() }} · </span>{{ heading() }}
      </h3>
      <div class="tags">
        <app-tag [kind]="modalite()">{{ modes[modalite()] }}</app-tag>
        @for (tag of tags(); track tag) {
          <app-tag>{{ tag }}</app-tag>
        }
      </div>
      <div class="seats">
        {{ seats() }}<i aria-hidden="true"><em [style.width.%]="filled()"></em></i>
      </div>
    </div>
    <div class="act"><ng-content /></div>
  `,
})
export class SessionRow {
  readonly start = input.required<string>();
  readonly heading = input.required<string>();
  readonly modalite = input.required<Modalite>();
  readonly tags = input<readonly string[]>([]);
  readonly remaining = input.required<number>();
  readonly capacity = input.required<number>();

  protected readonly modes = LABELS.ui.modalities;
  protected readonly day = computed(() => dayFormat.format(new Date(this.start())));
  protected readonly month = computed(() =>
    monthFormat.format(new Date(this.start())).replace('.', ''),
  );
  protected readonly fullDate = computed(() => fullFormat.format(new Date(this.start())));
  protected readonly seats = computed(() => LABELS.ui.seats(this.remaining(), this.capacity()));
  protected readonly filled = computed(() => {
    const capacity = this.capacity();
    if (capacity <= 0) return 100;
    return Math.min(100, Math.round(((capacity - this.remaining()) / capacity) * 100));
  });
}
