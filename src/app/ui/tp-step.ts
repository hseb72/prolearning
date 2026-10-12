import { Component, input } from '@angular/core';
import type { GlossaryEntry } from '@shared/learning';
import { LABELS } from '../labels';
import { Md } from '../learning/md';

/** Étape de travaux pratiques, dans un `ol.tp-steps` : titre, consigne, résultat attendu. */
@Component({
  selector: 'li[appTpStep]',
  imports: [Md],
  template: `
    <h4>{{ heading() }}</h4>
    <app-md [text]="markdown()" [glossary]="glossary()" />
    @if (result()) {
      <div class="tp-res">
        <b>{{ labels.expectedResult }}</b>
        <app-md [text]="result()" [glossary]="glossary()" />
      </div>
    }
  `,
})
export class TpStep {
  readonly heading = input.required<string>();
  readonly markdown = input.required<string>();
  readonly result = input('');
  readonly glossary = input<readonly GlossaryEntry[]>([]);
  protected readonly labels = LABELS.ui;
}
