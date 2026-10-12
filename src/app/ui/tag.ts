import { Component, computed, input } from '@angular/core';

/** Pastille (`.tag`) : `online` vert, `distance` bleu, `site` ocre, sinon neutre. */
@Component({
  selector: 'app-tag',
  host: { '[class]': 'classes()' },
  template: `<ng-content />`,
})
export class Tag {
  readonly kind = input<'online' | 'distance' | 'site' | null>(null);
  protected readonly classes = computed(() => (this.kind() ? `tag ${this.kind()}` : 'tag'));
}
