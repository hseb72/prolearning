import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, output, signal } from '@angular/core';
import type { ManagerImportReport, ManagerImportRequest } from '@shared/auth';
import { firstValueFrom } from 'rxjs';
import { LABELS } from '../../labels';
import { DropZone } from '../../ui/import';
import { ToastService } from '../../ui/toast';

/** Taille maximale du fichier, comme l'API. */
const MAX_BYTES = 1_000_000;

/**
 * Import CSV des rattachements collaborateur → manager : le fichier est d'abord vérifié
 * (rapport ligne par ligne), puis appliqué d'un bloc s'il n'a aucune erreur.
 */
@Component({
  selector: 'app-manager-import',
  imports: [DropZone],
  template: `
    <section class="card import" aria-labelledby="import-title">
      <h2 id="import-title">{{ labels.importTitle }}</h2>
      <p class="small">{{ labels.importIntro }}</p>
      <p class="small">
        <a href="/api/users/rattachements.csv" download>{{ labels.importTemplate }}</a>
      </p>
      <app-drop-zone accept=".csv,text/csv" [hint]="labels.importHint" (file)="check($event)" />

      <div aria-live="polite">
        @if (busy() && !report()) {
          <p role="status">{{ labels.importCheck(fileName()) }}</p>
        }
        @if (error(); as e) {
          <p class="fb bad" role="alert">{{ e }}</p>
        }
        @if (report(); as r) {
          @if (r.fileError) {
            <p class="fb bad" role="alert">{{ r.fileError }}</p>
          } @else {
            <p class="fb" [class.bad]="r.counts.error > 0" [class.good]="r.counts.error === 0">
              <strong>{{ fileName() }} · {{ labels.importSummary(r.counts) }}</strong>
            </p>
            @if (r.promoted.length) {
              <p class="small">{{ labels.importPromoted(r.promoted.join(', ')) }}</p>
            }
            @if (changes().length) {
              <div class="bo-wrap">
                <table class="bo lines">
                  <caption class="visually-hidden">
                    {{
                      labels.importTitle
                    }}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{{ labels.importColumns.line }}</th>
                      <th scope="col">{{ labels.importColumns.member }}</th>
                      <th scope="col">{{ labels.importColumns.manager }}</th>
                      <th scope="col">{{ labels.importColumns.result }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of changes(); track l.line) {
                      <tr [class.ko]="l.status === 'error'">
                        <td>{{ l.line }}</td>
                        <th scope="row">{{ l.member }}</th>
                        <td>{{ l.manager ?? labels.importNone }}</td>
                        <td>
                          <b>{{ labels.importStatus[l.status] }}</b>
                          @if (l.message) {
                            — {{ l.message }}
                          } @else if (l.status === 'updated') {
                            ({{ labels.importFrom(l.previousManager ?? null) }})
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
            @if (r.counts.error) {
              <p class="small">{{ labels.importErrorsBlock }}</p>
            } @else if (!changes().length) {
              <p class="small">{{ labels.importNothing }}</p>
            }
            <div class="acts">
              @if (!r.counts.error && changes().length) {
                <button class="btn" type="button" [disabled]="busy()" (click)="apply()">
                  {{ labels.importApply }}
                </button>
              }
              <button class="btn ghost" type="button" [disabled]="busy()" (click)="reset()">
                {{ labels.importCancel }}
              </button>
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .import {
      display: grid;
      gap: 12px;
      margin-bottom: 24px;
    }
    h2,
    p {
      margin: 0;
    }
    .lines th[scope='row'] {
      font-weight: 400;
      overflow-wrap: anywhere;
    }
    .lines tr.ko td,
    .lines tr.ko th {
      color: var(--bad);
    }
    .acts {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
})
export class ManagerImport {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  readonly imported = output<void>();
  protected readonly labels = LABELS.users;
  protected readonly report = signal<ManagerImportReport | null>(null);
  protected readonly fileName = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  private content = '';
  /** Les lignes inchangées ne sont que comptées. */
  protected readonly changes = computed(
    () => this.report()?.lines.filter((l) => l.status !== 'unchanged') ?? [],
  );

  protected async check(file: File): Promise<void> {
    this.reset();
    this.fileName.set(file.name);
    if (file.size > MAX_BYTES) {
      this.error.set(this.labels.importHint);
      return;
    }
    try {
      this.content = await file.text();
    } catch {
      this.error.set(this.labels.importReadFailed);
      return;
    }
    await this.send(false);
  }

  protected async apply(): Promise<void> {
    await this.send(true);
  }

  protected reset(): void {
    this.report.set(null);
    this.error.set(null);
    this.content = '';
  }

  private async send(apply: boolean): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const body: ManagerImportRequest = { contenu: this.content, appliquer: apply };
    try {
      const report = await firstValueFrom(
        this.http.post<ManagerImportReport>('/api/users/rattachements', body),
      );
      if (report.applied) {
        this.toast.show(this.labels.importDone(report.counts));
        this.reset();
        this.imported.emit();
      } else {
        this.report.set(report);
      }
    } catch (err) {
      // Application refusée (422) : le rapport dit pourquoi.
      if (err instanceof HttpErrorResponse && err.status === 422 && err.error?.lines) {
        this.report.set(err.error as ManagerImportReport);
      } else {
        this.error.set(
          err instanceof HttpErrorResponse && typeof err.error?.message === 'string'
            ? err.error.message
            : this.labels.importFailed,
        );
      }
    } finally {
      this.busy.set(false);
    }
  }
}
