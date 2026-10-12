import { Component } from '@angular/core';

/** État vide (`.empty`) : message centré, avec un lien d'action en contenu. */
@Component({
  selector: 'app-empty',
  host: { class: 'empty' },
  template: `<ng-content />`,
})
export class EmptyState {}
