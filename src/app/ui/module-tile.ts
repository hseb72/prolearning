import { Component, computed, input } from '@angular/core';

export type TileState = 'done' | 'next' | 'locked' | 'special' | '';

/**
 * Tuile de module (`.node`) sur un bouton ou un lien : numéro (✓ une fois terminé), titre,
 * sous-titre ; états `done`, `next`, `locked`, `special`.
 */
@Component({
  selector: 'a[appModuleTile], button[appModuleTile]',
  host: {
    '[class]': 'classes()',
    '[attr.aria-disabled]': 'tileState() === "locked" ? "true" : null',
  },
  template: `
    <span class="num" aria-hidden="true">{{ tileState() === 'done' ? '✓' : num() }}</span>
    <span class="t">{{ heading() }}</span>
    <span class="s">{{ sub() }}</span>
  `,
})
export class ModuleTile {
  readonly num = input.required<string | number>();
  readonly heading = input.required<string>();
  readonly sub = input('');
  readonly tileState = input<TileState>('');
  protected readonly classes = computed(() => `node ${this.tileState()}`.trim());
}
