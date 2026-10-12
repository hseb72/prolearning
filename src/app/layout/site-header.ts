import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import type { AccountSummary } from '@shared/auth';
import type { MyRequests, TeamRequests, TrainingQueue } from '@shared/requests';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth';
import { LABELS } from '../labels';
import { ConfirmService } from '../ui/confirm';
import { ToastService } from '../ui/toast';

/**
 * En-tête du portail (SPEC-UI § 3) : marque, personne connectée et son rôle, bascule
 * PRODUCTION | DÉMO et compte joué (administrateurs), onglets avec compteurs, puis le
 * bandeau de l'espace actif.
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="top">
      <div class="top-in">
        <a class="logo" [routerLink]="me() ? '/catalogue' : '/connexion'"
          >{{ app.name }}<small>{{ app.tagline }}</small></a
        >
        @if (me(); as me) {
          <div class="me">
            <div class="me-name">
              <span class="visually-hidden">{{
                me.space === 'demo' ? app.playingAs : app.connectedAs
              }}</span>
              {{ me.actor.displayName }} · {{ rolesLower[me.actor.role] }}
            </div>
            @if (me.canSwitchSpace) {
              <div class="spacesw" role="group" [attr.aria-label]="space.switchLabel">
                <button
                  type="button"
                  [attr.aria-pressed]="me.space === 'production'"
                  [attr.aria-label]="space.toProduction"
                  [disabled]="busy()"
                  (click)="switchTo('production')"
                >
                  {{ space.production }}
                </button>
                <button
                  type="button"
                  [attr.aria-pressed]="me.space === 'demo'"
                  [attr.aria-label]="space.toDemo"
                  [disabled]="busy()"
                  (click)="switchTo('demo')"
                >
                  {{ space.demo }}
                </button>
              </div>
            }
            <div class="me-row">
              @if (me.space === 'demo') {
                <div class="me-persona">
                  <label for="persona">{{ space.persona }}</label>
                  <select id="persona" [disabled]="busy()" (change)="choosePersona($event)">
                    @for (persona of personas(); track persona.id) {
                      <option [value]="persona.id" [selected]="persona.id === me.actor.id">
                        {{ persona.displayName }} — {{ roles[persona.role] }}
                      </option>
                    } @empty {
                      <option [value]="me.actor.id" selected>
                        {{ me.actor.displayName }} — {{ roles[me.actor.role] }}
                      </option>
                    }
                  </select>
                </div>
              }
              <button class="me-logout" type="button" (click)="logout()">{{ app.logout }}</button>
            </div>
          </div>
        }
      </div>
      @if (me()) {
        <nav class="nav" [attr.aria-label]="app.mainNav">
          <a routerLink="/catalogue" routerLinkActive ariaCurrentWhenActive="page">{{
            nav.catalog
          }}</a>
          <a routerLink="/sessions" routerLinkActive ariaCurrentWhenActive="page">{{
            nav.sessions
          }}</a>
          @if (isManager()) {
            <a routerLink="/demandes/sur-mesure" routerLinkActive ariaCurrentWhenActive="page">{{
              nav.custom
            }}</a>
          }
          <a
            routerLink="/demandes"
            routerLinkActive
            [routerLinkActiveOptions]="{ exact: true }"
            ariaCurrentWhenActive="page"
            >{{ nav.myRequests }}
            @if (counts().mine) {
              <span class="n">{{ counts().mine }}</span>
            }
          </a>
          @if (isManager()) {
            <a routerLink="/demandes/equipe" routerLinkActive ariaCurrentWhenActive="page"
              >{{ nav.team }}
              @if (counts().team) {
                <span class="n">{{ counts().team }}</span>
              }
            </a>
          }
          <a routerLink="/parcours" routerLinkActive ariaCurrentWhenActive="page">{{
            nav.learning
          }}</a>
          @if (isTraining()) {
            <a routerLink="/administration" routerLinkActive ariaCurrentWhenActive="page"
              >{{ nav.admin }}
              @if (counts().admin) {
                <span class="n">{{ counts().admin }}</span>
              }
            </a>
          }
        </nav>
      }
    </header>
    @if (me(); as me) {
      <div class="demo" [class.prod]="me.space === 'production'" [attr.data-space]="me.space">
        {{ me.space === 'demo' ? space.demoBanner : space.productionBanner }}
        @if (me.space === 'demo') {
          ·
          <button class="link" type="button" [disabled]="busy()" (click)="reset()">
            {{ space.reset }}
          </button>
        }
      </div>
    }
  `,
  styles: `
    .me {
      display: grid;
      justify-items: end;
      gap: 2px;
    }
    .me-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 6px 14px;
      margin-top: 6px;
    }
    .me-persona {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .me-persona select {
      max-width: 220px;
      border: 1px solid var(--navy-line);
      border-radius: 999px;
      background: var(--navy);
      color: var(--on-navy);
      font-size: 12px;
      padding: 3px 10px;
    }
    .me-logout {
      border: 0;
      padding: 0;
      background: none;
      color: var(--on-navy-muted);
      font-size: 13px;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
    }
    .demo .link {
      color: inherit;
    }
    @media (max-width: 640px) {
      .me {
        justify-items: start;
        text-align: left;
      }
      .me-row {
        justify-content: flex-start;
      }
    }
  `,
})
export class SiteHeader {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly app = LABELS.app;
  protected readonly nav = LABELS.nav;
  protected readonly roles = LABELS.roles;
  protected readonly rolesLower = LABELS.rolesLower;
  protected readonly space = LABELS.space;
  protected readonly me = this.auth.me;
  protected readonly personas = signal<AccountSummary[]>([]);
  protected readonly busy = signal(false);

  protected readonly isManager = computed(() => this.auth.hasRole('manager'));
  protected readonly isTraining = computed(() => this.auth.hasRole('training'));

  // Compteurs des onglets, relus à chaque navigation (les demandes changent d'une page à l'autre).
  private readonly navigations = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((_, i) => i),
    ),
    { initialValue: -1 },
  );
  private readonly key = computed(() => {
    const me = this.me();
    return me ? { espace: me.space, compte: me.actor.id, n: this.navigations() } : null;
  });
  private readonly mine = httpResource<MyRequests>(() => {
    const key = this.key();
    return key ? { url: '/api/demandes', params: key } : undefined;
  });
  private readonly team = httpResource<TeamRequests>(() => {
    const key = this.key();
    return key && this.isManager() ? { url: '/api/demandes/equipe', params: key } : undefined;
  });
  private readonly queue = httpResource<TrainingQueue>(() => {
    const key = this.key();
    return key && this.isTraining() ? { url: '/api/demandes/a-traiter', params: key } : undefined;
  });

  protected readonly counts = computed(() => {
    const mine = this.mine.hasValue() ? this.mine.value() : undefined;
    const queue = this.queue.hasValue() ? this.queue.value() : undefined;
    const team = this.team.hasValue() ? this.team.value() : undefined;
    return {
      mine: mine
        ? mine.inscriptions.filter((r) =>
            ['attente_manager', 'attente_formation'].includes(r.statut),
          ).length +
          mine.surMesure.filter((r) => ['a_traiter', 'en_cours'].includes(r.statut)).length
        : 0,
      team: team ? team.aValider.length : 0,
      admin: queue
        ? queue.inscriptions.length + queue.surMesure.filter((r) => r.statut === 'a_traiter').length
        : 0,
    };
  });

  constructor() {
    // Liste des comptes jouables, chargée à la première entrée en démonstration.
    effect(() => {
      if (this.me()?.space === 'demo' && untracked(this.personas).length === 0) {
        this.auth.personas().then(
          (list) => this.personas.set(list),
          () => this.toast.show(this.space.switchFailed),
        );
      }
    });
  }

  protected switchTo(space: 'production' | 'demo'): Promise<boolean> {
    if (this.me()?.space === space) return Promise.resolve(true);
    return this.run(() => this.auth.switchSpace(space), this.space.switchFailed);
  }

  protected choosePersona(event: Event): Promise<boolean> {
    const id = Number((event.target as HTMLSelectElement).value);
    return this.run(() => this.auth.switchSpace('demo', id), this.space.switchFailed);
  }

  protected async reset(): Promise<void> {
    const ok = await this.confirm.ask({
      eyebrow: this.space.demo,
      title: this.space.reset,
      text: this.space.confirmReset,
      confirm: this.space.reset,
    });
    if (!ok) return;
    const done = await this.run(async () => {
      await this.auth.resetDemo();
      this.personas.set(await this.auth.personas());
    }, this.space.resetFailed);
    if (done) this.toast.show(this.space.resetDone);
  }

  protected async logout(): Promise<void> {
    const redirect = await this.auth.logout().catch(() => '/connexion');
    // La déconnexion Keycloak est une autre adresse : navigation complète.
    if (redirect.startsWith('/')) await this.router.navigateByUrl(redirect);
    else window.location.assign(redirect);
  }

  /** Les données affichées appartiennent à l'ancien espace : on repart du catalogue. */
  private async run(action: () => Promise<void>, failure: string): Promise<boolean> {
    this.busy.set(true);
    try {
      await action();
      await this.router.navigateByUrl('/catalogue');
      return true;
    } catch {
      this.toast.show(failure);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
