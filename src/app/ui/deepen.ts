import { Component, input } from '@angular/core';
import { LABELS } from '../labels';

/** Contenu à approfondir (`details.ap`), replié par défaut. */
@Component({
  selector: 'app-deepen',
  template: `
    <details class="ap" [open]="open()">
      <summary>
        {{ heading() }}<small>{{ tag() }}</small>
      </summary>
      <div class="in"><ng-content /></div>
    </details>
  `,
})
export class Deepen {
  readonly heading = input.required<string>();
  /** Mention à droite du titre (« Approfondir », « Dépannage », « Après le TP »…). */
  readonly tag = input<string>(LABELS.ui.deepen);
  readonly open = input(false);
}
