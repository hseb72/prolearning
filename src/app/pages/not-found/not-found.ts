import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LABELS } from '../../labels';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <h1>{{ labels.title }}</h1>
    <p>{{ labels.text }}</p>
    <p>
      <a routerLink="/">{{ labels.back }}</a>
    </p>
  `,
})
export class NotFoundPage {
  protected readonly labels = LABELS.notFound;
}
