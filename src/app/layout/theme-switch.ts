import { Component, inject } from '@angular/core';
import { ThemeService, type ThemePreference } from '../core/theme';
import { LABELS } from '../labels';

/** Choix du thème, dans le pied de page : système, clair ou sombre. */
@Component({
  selector: 'app-theme-switch',
  template: `
    <label>
      {{ labels.label }}
      <select
        [value]="theme.preference()"
        (change)="theme.preference.set($any($event.target).value)"
      >
        @for (option of options; track option) {
          <option [value]="option" [selected]="option === theme.preference()">
            {{ labels.options[option] }}
          </option>
        }
      </select>
    </label>
  `,
  styles: `
    label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    select {
      font: inherit;
      color: var(--ink);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 2px 6px;
    }
  `,
})
export class ThemeSwitch {
  protected readonly theme = inject(ThemeService);
  protected readonly labels = LABELS.theme;
  protected readonly options: ThemePreference[] = ['system', 'light', 'dark'];
}
