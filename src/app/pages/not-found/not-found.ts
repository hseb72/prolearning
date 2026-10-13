import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LABELS } from '../../labels';
import { EmptyState } from '../../ui/empty';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, EmptyState],
  template: `
    <app-empty class="card">
      <h1>{{ labels.title }}</h1>
      <p>{{ labels.text }}</p>
      <a class="btn" routerLink="/">{{ labels.back }}</a>
    </app-empty>
  `,
})
export class NotFoundPage {
  protected readonly labels = LABELS.notFound;
}
