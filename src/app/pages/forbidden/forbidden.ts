import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LABELS } from '../../labels';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  template: `
    <h1>{{ labels.title }}</h1>
    <p>{{ labels.text }}</p>
    <p>
      <a routerLink="/">{{ back }}</a>
    </p>
  `,
})
export class ForbiddenPage {
  protected readonly labels = LABELS.forbidden;
  protected readonly back = LABELS.notFound.back;
}
