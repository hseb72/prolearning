import { Component, computed, input } from '@angular/core';

/** Option de quiz (`.opt`) : lettre dans une pastille, texte ; `ok` vert, `ko` rouge. */
@Component({
  selector: 'button[appQuizOption], label[appQuizOption]',
  host: { '[class]': 'classes()' },
  template: `<b aria-hidden="true">{{ letter() }}</b
    ><span><ng-content /></span>`,
})
export class QuizOption {
  readonly letter = input.required<string>();
  readonly state = input<'ok' | 'ko' | null>(null);
  protected readonly classes = computed(() => (this.state() ? `opt ${this.state()}` : 'opt'));
}
