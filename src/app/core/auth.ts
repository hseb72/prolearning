import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import type { AccountSummary, AuthConfig, Me } from '@shared/auth';
import { hasRole, type Role } from '@shared/roles';
import type { Space } from '@shared/spaces';
import { firstValueFrom } from 'rxjs';

/** Session de la personne connectée, espace actif et compte joué. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** `undefined` tant que la session n'a pas été lue, `null` si personne n'est connecté. */
  readonly me = signal<Me | null | undefined>(undefined);
  readonly actor = computed(() => this.me()?.actor ?? null);
  readonly space = computed<Space>(() => this.me()?.space ?? 'production');

  hasRole(role: Role): boolean {
    const actor = this.actor();
    return actor !== null && hasRole(actor.role, role);
  }

  /** Lit la session une fois (au premier passage d'un garde), puis la garde en mémoire. */
  async load(force = false): Promise<Me | null> {
    const current = this.me();
    if (current !== undefined && !force) return current;
    try {
      const me = await firstValueFrom(this.http.get<Me>('/api/auth/me'));
      this.me.set(me);
      return me;
    } catch {
      this.me.set(null);
      return null;
    }
  }

  config(): Promise<AuthConfig> {
    return firstValueFrom(this.http.get<AuthConfig>('/api/auth/config'));
  }

  async devLogin(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/dev-login', { email }));
    await this.load(true);
  }

  /** Ferme la session, puis renvoie l'adresse où aller (déconnexion Keycloak le cas échéant). */
  async logout(): Promise<string> {
    const res = await firstValueFrom(this.http.post<{ redirect: string }>('/api/auth/logout', {}));
    this.me.set(null);
    return res.redirect;
  }

  async switchSpace(space: Space, personaId?: number): Promise<void> {
    const me = await firstValueFrom(this.http.post<Me>('/api/space', { space, personaId }));
    this.me.set(me);
  }

  /** Réinitialise l'espace démonstration (administrateurs) ; le compte joué redevient celui par défaut. */
  async resetDemo(): Promise<void> {
    const res = await firstValueFrom(this.http.post<{ me: Me }>('/api/demo/reinitialisation', {}));
    this.me.set(res.me);
  }

  personas(): Promise<AccountSummary[]> {
    return firstValueFrom(this.http.get<AccountSummary[]>('/api/space/personas'));
  }

  /** Session perdue (expirée, compte désactivé) : on oublie la personne. */
  forget(): void {
    this.me.set(null);
  }
}
