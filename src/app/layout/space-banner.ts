import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import type { AccountSummary } from '@shared/auth';
import { AuthService } from '../core/auth';
import { LABELS } from '../labels';

/**
 * Bandeau d'espace, visible des administrateurs (les seuls à pouvoir changer d'espace) :
 * bleu en production, orange en démonstration, avec la bascule et le choix du compte joué.
 */
@Component({
  selector: 'app-space-banner',
  templateUrl: './space-banner.html',
  styleUrl: './space-banner.scss',
})
export class SpaceBanner {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly labels = LABELS.space;
  protected readonly roles = LABELS.roles;
  protected readonly me = this.auth.me;
  protected readonly demo = computed(() => this.auth.space() === 'demo');
  protected readonly personas = signal<AccountSummary[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal('');

  protected async toDemo(): Promise<void> {
    await this.switch(() => this.auth.switchSpace('demo'));
  }

  protected async toProduction(): Promise<void> {
    await this.switch(() => this.auth.switchSpace('production'));
  }

  protected async choosePersona(event: Event): Promise<void> {
    const id = Number((event.target as HTMLSelectElement).value);
    await this.switch(() => this.auth.switchSpace('demo', id));
  }

  protected async reset(): Promise<void> {
    if (!confirm(this.labels.confirmReset)) return;
    const done = await this.switch(async () => {
      await this.auth.resetDemo();
      this.personas.set(await this.auth.personas());
    }, this.labels.resetFailed);
    if (done) this.status.set(this.labels.resetDone);
  }

  /** Les données affichées appartiennent à l'ancien espace : on repart de l'accueil. */
  private async switch(
    action: () => Promise<void>,
    failure: string = this.labels.switchFailed,
  ): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    this.status.set('');
    try {
      await action();
      await this.router.navigateByUrl('/');
      return true;
    } catch {
      this.error.set(failure);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  constructor() {
    // Liste des comptes jouables, chargée à la première entrée en démonstration.
    effect(() => {
      if (this.demo() && untracked(this.personas).length === 0) {
        this.auth.personas().then(
          (list) => this.personas.set(list),
          () => this.error.set(this.labels.switchFailed),
        );
      }
    });
  }
}
