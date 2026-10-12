import { Component, computed, input } from '@angular/core';
import { LABELS } from '../labels';

export type CalloutVariant = keyof typeof LABELS.ui.callouts;

/**
 * Encadré (`.enc`) : petit libellé en capitales (« À RETENIR »…), titre facultatif, contenu.
 * `label` remplace le libellé de la variante (« Objectif », « Point de départ » des TP).
 */
@Component({
  selector: 'app-callout',
  host: { '[class]': '"enc " + variant()' },
  template: `
    <div class="lab">{{ lab() }}</div>
    @if (heading()) {
      <h4>{{ heading() }}</h4>
    }
    <ng-content />
  `,
})
export class Callout {
  readonly variant = input.required<CalloutVariant>();
  readonly heading = input('');
  readonly label = input('');
  protected readonly lab = computed(() => this.label() || LABELS.ui.callouts[this.variant()]);
}
