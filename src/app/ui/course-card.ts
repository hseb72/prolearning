import { Component, input } from '@angular/core';
import { LABELS } from '../labels';
import { Tag } from './tag';

export type Mode = 'online' | 'distance' | 'site';

/**
 * Carte formation (`.fcard`) : thème, titre, pastilles de modalité, durée, puis un pied
 * collé en bas (information à gauche, action en contenu à droite).
 */
@Component({
  selector: 'app-course-card',
  imports: [Tag],
  host: { class: 'card fcard' },
  template: `
    <p class="eyebrow muted">{{ theme() }}</p>
    <h3>{{ heading() }}</h3>
    <div class="tags">
      @for (mode of modes(); track mode) {
        <app-tag [kind]="mode">{{ labels[mode] }}</app-tag>
      }
      <ng-content select="app-tag" />
    </div>
    @if (duration()) {
      <p class="muted small">{{ duration() }}</p>
    }
    <div class="foot">
      <span class="small muted">{{ info() }}</span>
      <ng-content />
    </div>
  `,
})
export class CourseCard {
  readonly theme = input('');
  readonly heading = input.required<string>();
  readonly modes = input<readonly Mode[]>([]);
  protected readonly labels = LABELS.ui.modalities;
  readonly duration = input('');
  readonly info = input('');
}
