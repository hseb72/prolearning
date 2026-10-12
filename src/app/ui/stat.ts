import { Component, input } from '@angular/core';

/** Chiffre clé (`.stat`) : valeur en sérif, libellé en gris. */
@Component({
  selector: 'app-stat',
  host: { class: 'stat' },
  template: `<b>{{ value() }}</b
    ><span>{{ label() }}</span>`,
})
export class Stat {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
}
