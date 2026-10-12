import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import type { UserRow, UserUpdate } from '@shared/auth';
import { hasRole, isRole, ROLES } from '@shared/roles';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth';
import { AdminNav } from '../../layout/admin-nav';
import { LABELS } from '../../labels';

/** Comptes et rôles de l'espace actif (RBAC tenu dans l'application). */
@Component({
  selector: 'app-users',
  imports: [DatePipe, AdminNav],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class UsersPage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  protected readonly labels = LABELS.users;
  protected readonly roleLabels = LABELS.roles;
  protected readonly roles = ROLES;
  protected readonly demo = computed(() => this.auth.space() === 'demo');
  protected readonly eyebrow = computed(() =>
    LABELS.requests.adminEyebrow(this.demo() ? LABELS.space.demoName : LABELS.space.productionName),
  );

  // Relu à chaque changement d'espace ou de compte joué : jamais les comptes de l'autre espace.
  protected readonly users = httpResource<UserRow[]>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/users', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  protected readonly managers = computed(() =>
    (this.users.value() ?? []).filter((user) => user.active && hasRole(user.role, 'manager')),
  );
  protected readonly status = signal<{ kind: 'success' | 'error'; text: string } | null>(null);

  protected managerName(id: number | null): string {
    return this.users.value()?.find((user) => user.id === id)?.displayName ?? '';
  }

  protected async changeRole(user: UserRow, event: Event): Promise<void> {
    const role = (event.target as HTMLSelectElement).value;
    if (isRole(role)) await this.save(user, { role }, event);
  }

  protected async changeManager(user: UserRow, event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    await this.save(user, { managerId: value ? Number(value) : null }, event);
  }

  private async save(user: UserRow, update: UserUpdate, event: Event): Promise<void> {
    try {
      const saved = await firstValueFrom(this.http.patch<UserRow>(`/api/users/${user.id}`, update));
      this.users.update((list) => list?.map((row) => (row.id === saved.id ? saved : row)));
      this.status.set({ kind: 'success', text: this.labels.saved(user.displayName) });
    } catch (error) {
      // Rétablit la valeur affichée : la modification n'a pas eu lieu.
      const select = event.target as HTMLSelectElement;
      select.value = 'role' in update ? user.role : String(user.managerId ?? '');
      const message =
        error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : this.labels.saveFailed;
      this.status.set({ kind: 'error', text: message });
    }
  }
}
