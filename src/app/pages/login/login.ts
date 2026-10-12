import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthConfig } from '@shared/auth';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Paramètres d'adresse : page où revenir, et code d'erreur renvoyé par l'API. */
  readonly retour = input<string>();
  readonly erreur = input<string>();

  protected readonly labels = LABELS.login;
  protected readonly config = signal<AuthConfig | null>(null);
  protected readonly devError = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly errorText = computed(() => {
    const code = this.erreur();
    return code ? (this.labels.errors[code] ?? this.labels.errors['sso-echec']) : null;
  });

  protected readonly ssoHref = computed(() => {
    const retour = this.safeRetour();
    return `/api/auth/login?retour=${encodeURIComponent(retour)}`;
  });

  constructor() {
    this.auth.config().then(
      (config) => this.config.set(config),
      () => this.config.set({ sso: false, devLogin: false }),
    );
  }

  private safeRetour(): string {
    const retour = this.retour();
    return retour && /^\/(?![/\\])/.test(retour) ? retour : '/';
  }

  protected async devLogin(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const email = (new FormData(form).get('email') ?? '').toString().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.devError.set(this.labels.devInvalid);
      return;
    }
    this.busy.set(true);
    this.devError.set(null);
    try {
      await this.auth.devLogin(email);
      await this.router.navigateByUrl(this.safeRetour());
    } catch {
      this.devError.set(this.labels.errors['sso-echec']!);
    } finally {
      this.busy.set(false);
    }
  }
}
