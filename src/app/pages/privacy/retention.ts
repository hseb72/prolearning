import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RETENTION_BOUNDS, type RetentionSettings } from '@shared/privacy';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth';
import { AdminNav } from '../../layout/admin-nav';
import { LABELS } from '../../labels';
import { ToastService } from '../../ui/toast';

type Key = keyof RetentionSettings;

/** Administration › Données personnelles : durées de conservation de l'espace actif. */
@Component({
  selector: 'app-retention',
  imports: [AdminNav],
  template: `
    <app-admin-nav />
    <p class="eyebrow">{{ eyebrow() }}</p>
    <h1>{{ labels.settingsTitle }}</h1>
    <p class="lead">{{ labels.settingsIntro }}</p>

    @if (data.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else if (!data.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else {
      <form class="card f retention" (submit)="save($event)">
        @for (key of keys; track key) {
          <div class="fld">
            <label class="l" [for]="'retention-' + key">{{ labels[key] }}</label>
            <small [id]="'retention-' + key + '-hint'">{{
              labels.between(bounds[key].min, bounds[key].max)
            }}</small>
            <input
              class="inp"
              type="number"
              required
              [id]="'retention-' + key"
              [min]="bounds[key].min"
              [max]="bounds[key].max"
              [attr.aria-describedby]="'retention-' + key + '-hint'"
              [value]="form()[key]"
              (input)="set(key, $any($event.target).valueAsNumber)"
            />
          </div>
        }
        @if (error(); as e) {
          <p class="fb bad" role="alert">{{ e }}</p>
        }
        <div class="acts">
          <button class="btn" type="submit" [disabled]="busy()">{{ labels.save }}</button>
        </div>
      </form>
    }
  `,
  styles: `
    .retention {
      max-width: 560px;
    }
    .acts {
      justify-content: flex-start;
    }
  `,
})
export class RetentionPage {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly labels = LABELS.privacy;
  protected readonly bounds = RETENTION_BOUNDS;
  protected readonly keys: Key[] = ['requestsMonths', 'auditMonths', 'inactiveMonths'];
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = signal<RetentionSettings>({
    requestsMonths: 36,
    auditMonths: 12,
    inactiveMonths: 12,
  });
  protected readonly eyebrow = computed(() =>
    LABELS.requests.adminEyebrow(
      this.auth.space() === 'demo' ? LABELS.space.demoName : LABELS.space.productionName,
    ),
  );

  protected readonly data = httpResource<RetentionSettings>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/parametres/conservation', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  constructor() {
    effect(() => {
      const value = this.data.value();
      if (value) this.form.set({ ...value });
    });
  }

  protected set(key: Key, value: number): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected async save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!(event.target as HTMLFormElement).reportValidity()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const saved = await firstValueFrom(
        this.http.put<RetentionSettings>('/api/parametres/conservation', this.form()),
      );
      this.form.set(saved);
      this.toast.show(this.labels.saved);
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : this.labels.saveFailed,
      );
    } finally {
      this.busy.set(false);
    }
  }
}
