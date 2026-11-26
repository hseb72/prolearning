import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import type {
  DelegationPerson,
  DelegationUpdate,
  DelegationView,
  MyDelegations,
} from '@shared/delegations';
import { firstValueFrom } from 'rxjs';
import { formatCalendarDay, parisDay } from '../catalog/dates';
import { AuthService } from '../core/auth';
import { apiMessage } from '../core/requests';
import { LABELS } from '../labels';
import { ToastService } from '../ui/toast';

/**
 * Réglage de la suppléance d'un manager : la sienne (« Mon équipe »), ou celle d'un manager
 * absent, par un administrateur (`managerId`). Un seul suppléant, pour une période.
 */
@Component({
  selector: 'app-delegation',
  template: `
    @if (state.error() || candidates.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else if (!state.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else {
      @if (current(); as d) {
        <p>
          {{ describe(d) }}
        </p>
      } @else if (!editing()) {
        <p class="muted">{{ labels.none }}</p>
      }

      @if (editing()) {
        <form class="f" (submit)="save($event)">
          <div class="fld">
            <label class="l" [for]="id('who')">{{ labels.delegate }}</label>
            <select
              class="search"
              required
              [id]="id('who')"
              [value]="form().suppleantId || ''"
              (change)="patch({ suppleantId: +$any($event.target).value })"
            >
              <option value="" disabled>{{ labels.choose }}</option>
              @for (p of candidates.value() ?? []; track p.id) {
                <option [value]="p.id" [selected]="p.id === form().suppleantId">
                  {{ p.displayName }} — {{ p.email }}
                </option>
              }
            </select>
          </div>
          <div class="dates">
            <div class="fld">
              <label class="l" [for]="id('from')">{{ labels.from }}</label>
              <input
                class="inp"
                type="date"
                required
                [id]="id('from')"
                [min]="today"
                [value]="form().debut"
                (input)="patch({ debut: $any($event.target).value })"
              />
            </div>
            <div class="fld">
              <label class="l" [for]="id('to')">{{ labels.to }}</label>
              <input
                class="inp"
                type="date"
                required
                [id]="id('to')"
                [min]="form().debut || today"
                [value]="form().fin"
                (input)="patch({ fin: $any($event.target).value })"
              />
            </div>
          </div>
          <div class="acts">
            <button class="btn" type="submit" [disabled]="busy()">{{ labels.save }}</button>
            @if (current()) {
              <button class="btn ghost" type="button" (click)="editing.set(false)">
                {{ labels.cancel }}
              </button>
            }
          </div>
        </form>
      } @else {
        <div class="acts">
          <button class="btn ghost" type="button" (click)="edit()">
            {{ current() ? labels.change : labels.save }}
          </button>
          @if (current()) {
            <button class="btn ghost danger" type="button" [disabled]="busy()" (click)="end()">
              {{ labels.end }}
            </button>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 12px;
    }
    p {
      margin: 0;
    }
    .dates {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .acts {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    select {
      width: 100%;
    }
  `,
})
export class DelegationEditor {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  /** Manager dont un administrateur règle la suppléance ; absent : la sienne. */
  readonly managerId = input<number | null>(null);
  protected readonly labels = LABELS.delegation;
  protected readonly today = parisDay();
  protected readonly busy = signal(false);
  protected readonly editing = signal(false);
  protected readonly form = signal<DelegationUpdate>({ suppleantId: 0, debut: '', fin: '' });

  private readonly url = computed(() => {
    const id = this.managerId();
    return id === null ? '/api/suppleance' : `/api/users/${id}/suppleance`;
  });
  private readonly params = computed(() => {
    const me = this.auth.me();
    return me ? { espace: me.space, compte: me.actor.id } : null;
  });

  protected readonly state = httpResource<MyDelegations | { suppleance: DelegationView | null }>(
    () => {
      const params = this.params();
      return params ? { url: this.url(), params } : undefined;
    },
  );
  protected readonly candidates = httpResource<DelegationPerson[]>(() => {
    const params = this.params();
    if (!params) return undefined;
    // L'administrateur reçoit les candidats avec la suppléance.
    return this.managerId() === null ? { url: '/api/suppleance/candidats', params } : undefined;
  });

  protected readonly current = computed<DelegationView | null>(() => {
    const value = this.state.value();
    if (!value) return null;
    return 'maSuppleance' in value ? value.maSuppleance : value.suppleance;
  });

  constructor() {
    effect(() => {
      // Côté administration, les candidats arrivent avec la suppléance.
      const value = this.state.value() as { candidats?: DelegationPerson[] } | undefined;
      if (value?.candidats) this.candidates.set(value.candidats);
    });
    // Sans suppléance prévue, le formulaire est ouvert d'emblée.
    effect(() => {
      if (this.state.hasValue() && !this.current()) untracked(() => this.edit());
    });
  }

  protected id(name: string): string {
    return `delegation-${this.managerId() ?? 'self'}-${name}`;
  }

  protected describe(d: DelegationView): string {
    const args = [
      d.suppleant.displayName,
      formatCalendarDay(d.debut),
      formatCalendarDay(d.fin),
    ] as const;
    if (this.managerId() !== null) return this.labels.adminCurrent(...args);
    return d.etat === 'a_venir' ? this.labels.planned(...args) : this.labels.current(...args);
  }

  protected patch(change: Partial<DelegationUpdate>): void {
    this.form.update((f) => ({ ...f, ...change }));
  }

  protected edit(): void {
    const d = this.current();
    this.form.set(
      d
        ? {
            suppleantId: d.suppleant.id,
            debut: d.debut < this.today ? this.today : d.debut,
            fin: d.fin,
          }
        : { suppleantId: 0, debut: this.today, fin: parisDay(7) },
    );
    this.editing.set(true);
  }

  protected async save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!(event.target as HTMLFormElement).reportValidity()) return;
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(this.http.put<DelegationView>(this.url(), this.form()));
      this.state.update((value) =>
        value && 'maSuppleance' in value
          ? { ...value, maSuppleance: saved }
          : { ...(value ?? {}), suppleance: saved },
      );
      this.editing.set(false);
      this.toast.show(this.labels.saved);
    } catch (error) {
      this.toast.show(apiMessage(error, this.labels.failed));
    } finally {
      this.busy.set(false);
    }
  }

  protected async end(): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.http.delete(this.url()));
      this.state.reload();
      this.toast.show(this.labels.ended);
    } catch (error) {
      this.toast.show(apiMessage(error, this.labels.failed));
    } finally {
      this.busy.set(false);
    }
  }
}
