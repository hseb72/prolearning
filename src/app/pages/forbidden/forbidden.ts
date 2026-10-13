import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LABELS } from '../../labels';
import { EmptyState } from '../../ui/empty';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, EmptyState],
  template: `
    <app-empty class="card">
      <h1>{{ labels.title }}</h1>
      <p>{{ labels.text }}</p>
      <a class="btn" routerLink="/">{{ back }}</a>
    </app-empty>
  `,
})
export class ForbiddenPage {
  protected readonly labels = LABELS.forbidden;
  protected readonly back = LABELS.notFound.back;
}
