import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FormationRow, ValidationReport } from '@shared/format';
import { AuthService } from '../../core/auth';
import { FormationsService } from '../../core/formations';
import { LABELS } from '../../labels';

type Status = { kind: 'success' | 'error'; text: string };

/**
 * Formations en évaluation : import (avec rapport), liste, relecture, export, publication
 * en production et copie en démonstration.
 */
@Component({
  selector: 'app-formations',
  imports: [RouterLink],
  templateUrl: './formations.html',
  styleUrl: './formations.scss',
})
export class FormationsPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(FormationsService);
  private readonly date = new DatePipe('fr');

  protected readonly labels = LABELS.formations;
  protected readonly file = signal<File | null>(null);
  protected readonly replace = signal(false);
  protected readonly busy = signal(false);
  protected readonly report = signal<ValidationReport | null>(null);
  protected readonly status = signal<Status | null>(null);

  // Relu à chaque changement d'espace ou de compte joué, et après chaque import.
  private readonly refresh = signal(0);
  protected readonly formations = httpResource<FormationRow[]>(() => {
    const me = this.auth.me();
    return me
      ? {
          url: '/api/formations',
          params: { espace: me.space, compte: me.actor.id, n: this.refresh() },
        }
      : undefined;
  });

  protected exportUrl(id: string, version: string): string {
    return this.service.exportUrl(id, version);
  }

  protected chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.report.set(null);
    this.status.set(null);
  }

  protected async check(): Promise<void> {
    const file = this.requireFile();
    if (!file) return;
    await this.run(async () => this.report.set(await this.service.validate(file)));
  }

  protected async importFile(): Promise<void> {
    const file = this.requireFile();
    if (!file) return;
    await this.run(async () => {
      const result = await this.service.import(file, this.replace());
      this.report.set(result.rapport);
      if (result.importee) {
        this.status.set({ kind: 'success', text: this.labels.imported[result.action!]! });
        this.refresh.update((n) => n + 1);
      } else if (result.refus) {
        this.status.set({ kind: 'error', text: this.labels.refused(result.refus) });
      }
    });
  }

  protected async publish(formation: FormationRow, version: string): Promise<void> {
    if (!window.confirm(this.labels.publishConfirm(formation.titre, version))) return;
    await this.run(async () => {
      const result = await this.service.publish(formation.id, version);
      this.status.set(
        result.publiee
          ? { kind: 'success', text: this.labels.published(version) }
          : { kind: 'error', text: this.labels.publishRefused(result.refus ?? this.labels.failed) },
      );
      this.refresh.update((n) => n + 1);
    });
  }

  protected async copyToDemo(formation: FormationRow, version: string): Promise<void> {
    await this.run(async () => {
      const result = await this.service.copyToDemo(formation.id, version);
      this.status.set(
        result.copiee
          ? { kind: 'success', text: this.labels.copied(version) }
          : { kind: 'error', text: this.labels.copyRefused(result.refus ?? this.labels.failed) },
      );
      this.refresh.update((n) => n + 1);
    });
  }

  protected formatDate(iso: string): string {
    return this.date.transform(iso, 'short') ?? iso;
  }

  private requireFile(): File | null {
    const file = this.file();
    if (!file) this.status.set({ kind: 'error', text: this.labels.noFile });
    return file;
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.status.set(null);
    try {
      await action();
    } catch {
      this.status.set({ kind: 'error', text: this.labels.failed });
    } finally {
      this.busy.set(false);
    }
  }
}
