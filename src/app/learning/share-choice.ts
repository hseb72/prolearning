import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, ElementRef, inject, input, signal } from '@angular/core';
import { SHARE_VISIBILITIES, type ShareVisibility } from '@shared/learning';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth';
import { LABELS } from '../labels';
import { ToastService } from '../ui/toast';

/**
 * Choix de l'apprenant pour un parcours (décision 5) : privé par défaut, ou visible de son
 * manager, ou de tous. Possible dès qu'un module est terminé.
 */
@Component({
  selector: 'app-share-choice',
  template: `
    <fieldset class="card share" [disabled]="!canShare() || busy() || !saved.hasValue()">
      <legend>{{ labels.title }}</legend>
      <p class="small muted">{{ labels.intro }}</p>
      @if (!canShare()) {
        <p class="small">{{ labels.notYet }}</p>
      }
      @if (saved.error()) {
        <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
      }
      <div class="radios" [attr.aria-busy]="!saved.hasValue()">
        @for (option of options; track option) {
          <label class="radio">
            <input
              type="radio"
              name="share-visibility"
              [value]="option"
              [checked]="saved.hasValue() && option === current()"
              [attr.aria-describedby]="'share-hint-' + option"
              (change)="choose(option)"
            />
            <span>
              {{ labels.options[option] }}
              <small [id]="'share-hint-' + option">{{ labels.hints[option] }}</small>
            </span>
          </label>
        }
      </div>
    </fieldset>
  `,
  styles: `
    .share {
      display: grid;
      gap: 10px;
      border: 1px solid var(--line);
      margin: 0;
      min-width: 0;
    }
    legend {
      font-family: var(--display);
      font-size: 18px;
      font-weight: 600;
      padding: 0 6px;
    }
    p {
      margin: 0;
    }
    .radios {
      display: grid;
      gap: 8px;
    }
    .radio {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      cursor: pointer;
    }
    .radio input {
      margin-top: 4px;
    }
    .radio small {
      display: block;
      color: var(--muted);
      font-size: 13px;
    }
    fieldset:disabled .radio {
      cursor: default;
      color: var(--muted);
    }
  `,
})
export class ShareChoice {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly formationId = input.required<string>();
  /** Au moins un module terminé : sinon, rien à montrer. */
  readonly canShare = input.required<boolean>();
  protected readonly labels = LABELS.shares;
  protected readonly options = SHARE_VISIBILITIES;
  protected readonly busy = signal(false);
  /** Choix fait sur cette page ; à défaut, celui enregistré. */
  private readonly chosen = signal<ShareVisibility | null>(null);

  protected readonly saved = httpResource<{ visibilite: ShareVisibility }>(() => {
    const me = this.auth.me();
    return me
      ? {
          url: `/api/parcours/${encodeURIComponent(this.formationId())}/partage`,
          params: { espace: me.space, compte: me.actor.id },
        }
      : undefined;
  });
  protected readonly current = computed(
    () => this.chosen() ?? this.saved.value()?.visibilite ?? 'prive',
  );

  protected async choose(option: ShareVisibility): Promise<void> {
    const previous = this.current();
    this.chosen.set(option);
    this.busy.set(true);
    try {
      const res = await firstValueFrom(
        this.http.put<{ visibilite: ShareVisibility }>(
          `/api/parcours/${encodeURIComponent(this.formationId())}/partage`,
          { visibilite: option },
        ),
      );
      this.chosen.set(res.visibilite);
      this.toast.show(this.labels.saved(this.labels.options[res.visibilite]!));
    } catch (error) {
      this.chosen.set(previous);
      // Le navigateur a coché le bouton cliqué : on remet le groupe dans l'état enregistré.
      for (const radio of this.host.nativeElement.querySelectorAll('input[type=radio]')) {
        (radio as HTMLInputElement).checked = (radio as HTMLInputElement).value === previous;
      }
      this.toast.show(
        error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : this.labels.failed,
      );
    } finally {
      this.busy.set(false);
    }
  }
}
