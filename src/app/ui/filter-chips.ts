import { Component, input, model } from '@angular/core';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/** Filtres en pilules (`.chipbtn`) : un seul actif, signalé par `aria-pressed`. */
@Component({
  selector: 'app-filter-chips',
  host: { class: 'chips', role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        class="chipbtn"
        [attr.aria-pressed]="option.value === value()"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
})
export class FilterChips<T extends string> {
  readonly options = input.required<readonly ChipOption<T>[]>();
  readonly label = input.required<string>();
  readonly value = model.required<T>();
}
