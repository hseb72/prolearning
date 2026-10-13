import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AUDIT_FAMILIES, type AuditEntryView, type AuditPage } from '@shared/audit';
import { firstValueFrom } from 'rxjs';
import { formatDateTime } from '../../catalog/dates';
import { AuthService } from '../../core/auth';
import { AdminNav } from '../../layout/admin-nav';
import { LABELS } from '../../labels';
import { EmptyState } from '../../ui/empty';
import { FilterChips, type ChipOption } from '../../ui/filter-chips';

type Family = 'all' | (typeof AUDIT_FAMILIES)[number];

/** Administration › Journal : actions journalisées de l'espace actif, en lecture seule. */
@Component({
  selector: 'app-journal',
  imports: [AdminNav, EmptyState, FilterChips],
  template: `
    <app-admin-nav />
    <p class="eyebrow">{{ eyebrow() }}</p>
    <h1>{{ labels.title }}</h1>
    <p class="lead">{{ labels.intro }}</p>

    <div class="filters">
      <app-filter-chips [label]="labels.filter" [options]="options" [(value)]="family" />
    </div>

    @if (error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else if (loading() && !entries().length) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (!entries().length) {
      <app-empty class="card">{{ labels.empty }}</app-empty>
    } @else {
      <div class="card bo-wrap">
        <table class="bo journal">
          <caption class="visually-hidden">
            {{
              labels.title
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ labels.when }}</th>
              <th scope="col">{{ labels.who }}</th>
              <th scope="col">{{ labels.what }}</th>
              <th scope="col">{{ labels.details }}</th>
            </tr>
          </thead>
          <tbody>
            @for (e of entries(); track e.id) {
              <tr>
                <td class="when">{{ when(e) }}</td>
                <td>{{ e.actorLabel ?? labels.system }}</td>
                <th scope="row">{{ labels.actions[e.action] ?? e.action }}</th>
                <td class="small">{{ details(e) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (next() !== null) {
        <p class="more">
          <button class="btn ghost" type="button" [disabled]="loading()" (click)="loadMore()">
            {{ labels.more }}
          </button>
        </p>
      }
    }
  `,
  styles: `
    .journal th[scope='row'] {
      font-weight: 600;
    }
    .when {
      white-space: nowrap;
    }
    .more {
      margin-top: 16px;
    }
  `,
})
export class JournalPage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.journal;
  protected readonly options: ChipOption<Family>[] = (['all', ...AUDIT_FAMILIES] as Family[]).map(
    (value) => ({ value, label: LABELS.journal.families[value]! }),
  );
  protected readonly family = signal<Family>('all');
  protected readonly entries = signal<AuditEntryView[]>([]);
  protected readonly next = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly eyebrow = computed(() =>
    LABELS.requests.adminEyebrow(
      this.auth.space() === 'demo' ? LABELS.space.demoName : LABELS.space.productionName,
    ),
  );

  constructor() {
    // Nouveau filtre, autre espace ou autre compte joué : on repart de la page la plus récente.
    effect(() => {
      this.family();
      this.auth.me();
      untracked(() => void this.load(true));
    });
  }

  protected loadMore(): void {
    void this.load(false);
  }

  protected when(e: AuditEntryView): string {
    return formatDateTime(e.occurredAt);
  }

  protected details(e: AuditEntryView): string {
    return Object.entries(e.details)
      .map(([key, value]) => `${this.labels.keys[key] ?? key} : ${format(value)}`)
      .join(' · ');
  }

  /** Numéro de la dernière lecture : une réponse arrivée après un changement de filtre est ignorée. */
  private request = 0;

  private async load(reset: boolean): Promise<void> {
    const me = this.auth.me();
    if (!me) return;
    const params: Record<string, string> = { espace: me.space, compte: String(me.actor.id) };
    if (this.family() !== 'all') params['famille'] = this.family();
    if (!reset && this.next() !== null) params['avant'] = String(this.next());
    const request = ++this.request;
    // Nouveau filtre : on n'affiche pas l'ancienne liste pendant la lecture de la nouvelle.
    if (reset) this.entries.set([]);
    this.loading.set(true);
    this.error.set(false);
    try {
      const page = await firstValueFrom(this.http.get<AuditPage>('/api/journal', { params }));
      if (request !== this.request) return;
      this.entries.update((list) => (reset ? page.entries : [...list, ...page.entries]));
      this.next.set(page.next);
    } catch {
      if (request === this.request) this.error.set(true);
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
}

function format(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
