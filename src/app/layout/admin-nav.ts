import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth';
import { LABELS } from '../labels';

/** Sous-navigation de l'onglet « Administration » : une pastille par rubrique. */
@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="filters" [attr.aria-label]="labels.label">
      <a
        class="chipbtn"
        routerLink="/administration/demandes"
        routerLinkActive
        ariaCurrentWhenActive="page"
        >{{ labels.requests }}</a
      >
      @if (isAdmin()) {
        <a
          class="chipbtn"
          routerLink="/administration/formations"
          routerLinkActive
          ariaCurrentWhenActive="page"
          >{{ labels.formations }}</a
        >
        <a
          class="chipbtn"
          routerLink="/administration/comptes"
          routerLinkActive
          ariaCurrentWhenActive="page"
          >{{ labels.users }}</a
        >
        <a
          class="chipbtn"
          routerLink="/administration/donnees"
          routerLinkActive
          ariaCurrentWhenActive="page"
          >{{ labels.privacy }}</a
        >
        <a
          class="chipbtn"
          routerLink="/administration/journal"
          routerLinkActive
          ariaCurrentWhenActive="page"
          >{{ labels.journal }}</a
        >
      }
    </nav>
  `,
  styles: `
    a.chipbtn {
      color: var(--ink);
      text-decoration: none;
    }
    a.chipbtn[aria-current='page'] {
      color: var(--on-navy);
    }
  `,
})
export class AdminNav {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.adminNav;
  protected readonly isAdmin = computed(() => this.auth.hasRole('admin'));
}
