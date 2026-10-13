import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FormationRow, ReportItem, SpaceFormations, ValidationReport } from '@shared/format';
import { AuthService } from '../../core/auth';
import { FormationsService } from '../../core/formations';
import { AdminNav } from '../../layout/admin-nav';
import { LABELS } from '../../labels';
import { ConfirmService } from '../../ui/confirm';
import { DropZone, ImportReport } from '../../ui/import';
import { Tag } from '../../ui/tag';
import { ToastService } from '../../ui/toast';

/**
 * Formations en évaluation : import (avec rapport), liste, relecture, export, publication
 * en production et copie en démonstration.
 */
@Component({
  selector: 'app-formations',
  imports: [RouterLink, AdminNav, DropZone, ImportReport, Tag],
  templateUrl: './formations.html',
  styleUrl: './formations.scss',
})
export class FormationsPage {
  private readonly auth = inject(AuthService);
  private readonly service = inject(FormationsService);
  private readonly confirm = inject(ConfirmService);
  private readonly date = new DatePipe('fr');

  private readonly toast = inject(ToastService);
  protected readonly labels = LABELS.formations;
  protected readonly r = LABELS.requests;
  protected readonly spaceName = computed(() =>
    this.auth.me()?.space === 'demo' ? LABELS.space.demoName : LABELS.space.productionName,
  );
  protected readonly file = signal<File | null>(null);
  protected readonly replace = signal(false);
  protected readonly busy = signal(false);
  protected readonly report = signal<ValidationReport | null>(null);
  protected readonly error = signal<string | null>(null);

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

  /** Ce qui est en démonstration et en production, lu dans chacune de ces bases. */
  protected readonly spaces = httpResource<SpaceFormations>(() => {
    const me = this.auth.me();
    return me
      ? {
          url: '/api/formations/espaces',
          params: { espace: me.space, compte: me.actor.id, n: this.refresh() },
        }
      : undefined;
  });
  protected readonly inDemo = computed(() => this.rows(this.spaces.value()?.demonstration));
  protected readonly inProd = computed(() => this.rows(this.spaces.value()?.production));

  /** Version courante de chaque formation, et comment elle est arrivée dans l'espace. */
  private rows(list: FormationRow[] | undefined) {
    return (list ?? []).map((f) => {
      const current = f.versions.find((v) => v.version === f.versionCourante) ?? f.versions[0]!;
      const date = this.formatDate(current.importedAt);
      return {
        key: f.id,
        titre: f.titre,
        version: current.version,
        note:
          current.origine === 'publication'
            ? this.labels.publishedOn(date)
            : current.origine === 'copie'
              ? this.labels.copiedOn(date)
              : this.labels.loadedOn(date),
      };
    });
  }

  protected lines(items: ReportItem[]): string[] {
    return items.map((i) => `${i.chemin || this.labels.root} : ${i.message}`);
  }

  protected exportUrl(id: string, version: string): string {
    return this.service.exportUrl(id, version);
  }

  /** Fichier déposé : validé tout de suite (« validation du format avant tout import »). */
  protected async chooseFile(file: File): Promise<void> {
    this.file.set(file);
    this.report.set(null);
    this.replace.set(false);
    await this.run(async () => this.report.set(await this.service.validate(file)));
  }

  protected async importFile(): Promise<void> {
    const file = this.file();
    if (!file) return;
    await this.run(async () => {
      const result = await this.service.import(file, this.replace());
      this.report.set(result.rapport);
      if (result.importee) {
        this.toast.show(this.labels.imported[result.action!]!);
        this.report.set(null);
        this.file.set(null);
        this.refresh.update((n) => n + 1);
      } else if (result.refus) {
        this.error.set(this.labels.refused(result.refus));
      }
    });
  }

  protected async publish(formation: FormationRow, version: string): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.labels.publish,
      text: this.labels.publishConfirm(formation.titre, version),
      confirm: this.labels.publish,
    });
    if (!ok) return;
    await this.run(async () => {
      const result = await this.service.publish(formation.id, version);
      if (result.publiee) this.toast.show(this.labels.published(version));
      else this.error.set(this.labels.publishRefused(result.refus ?? this.labels.failed));
      this.refresh.update((n) => n + 1);
    });
  }

  protected async copyToDemo(formation: FormationRow, version: string): Promise<void> {
    await this.run(async () => {
      const result = await this.service.copyToDemo(formation.id, version);
      if (result.copiee) this.toast.show(this.labels.copied(version));
      else this.error.set(this.labels.copyRefused(result.refus ?? this.labels.failed));
      this.refresh.update((n) => n + 1);
    });
  }

  protected formatDate(iso: string): string {
    return this.date.transform(iso, 'short') ?? iso;
  }

  /** Réinitialisation de la démonstration (déplacée du bandeau vers l'administration). */
  protected async resetDemo(): Promise<void> {
    const ok = await this.confirm.ask({
      eyebrow: LABELS.space.demoName,
      title: this.labels.resetDemo,
      text: LABELS.space.confirmReset,
      confirm: this.labels.resetDemo,
    });
    if (!ok) return;
    await this.run(async () => {
      await this.auth.resetDemo();
      this.toast.show(LABELS.space.resetDone);
      this.refresh.update((n) => n + 1);
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch {
      this.error.set(this.labels.failed);
    } finally {
      this.busy.set(false);
    }
  }
}
