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
        #demandes="routerLinkActive"
        [attr.aria-pressed]="demandes.isActive"
        ariaCurrentWhenActive="page"
        >{{ labels.requests }}</a
      >
      @if (isAdmin()) {
        <a
          class="chipbtn"
          routerLink="/administration/formations"
          routerLinkActive
          #formations="routerLinkActive"
          [attr.aria-pressed]="formations.isActive"
          ariaCurrentWhenActive="page"
          >{{ labels.formations }}</a
        >
        <a
          class="chipbtn"
          routerLink="/administration/comptes"
          routerLinkActive
          #comptes="routerLinkActive"
          [attr.aria-pressed]="comptes.isActive"
          ariaCurrentWhenActive="page"
          >{{ labels.users }}</a
        >
      }
    </nav>
  `,
  styles: `
    a.chipbtn {
      color: var(--ink);
      text-decoration: none;
    }
    a.chipbtn[aria-pressed='true'] {
      color: var(--on-navy);
    }
  `,
})
export class AdminNav {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.adminNav;
  protected readonly isAdmin = computed(() => this.auth.hasRole('admin'));
}
