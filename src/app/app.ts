import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth';
import { LABELS } from './labels';
import { SpaceBanner } from './layout/space-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SpaceBanner],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly labels = LABELS.app;
  protected readonly nav = LABELS.nav;
  protected readonly roles = LABELS.roles;
  protected readonly me = this.auth.me;

  protected isAdmin(): boolean {
    return this.auth.hasRole('admin');
  }

  protected async logout(): Promise<void> {
    const redirect = await this.auth.logout().catch(() => '/connexion');
    // La déconnexion Keycloak est une autre adresse : navigation complète.
    if (redirect.startsWith('/')) await this.router.navigateByUrl(redirect);
    else window.location.assign(redirect);
  }
}
