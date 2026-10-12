import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { DemoCopyResult, ImportResult, PublishResult, ValidationReport } from '@shared/format';
import { firstValueFrom } from 'rxjs';

const RAW = { headers: { 'content-type': 'application/octet-stream' } };

/** Import, validation et publication des formations (réservés aux administrateurs). */
@Injectable({ providedIn: 'root' })
export class FormationsService {
  private readonly http = inject(HttpClient);

  validate(file: Blob): Promise<ValidationReport> {
    return firstValueFrom(
      this.http.post<ValidationReport>('/api/formations/validation', file, RAW),
    );
  }

  /** Les refus (422 fichier invalide, 409 règles de version) portent aussi un résultat. */
  async import(file: Blob, replace: boolean): Promise<ImportResult> {
    const url = `/api/formations/import${replace ? '?remplacer=oui' : ''}`;
    try {
      return await firstValueFrom(this.http.post<ImportResult>(url, file, RAW));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.error?.rapport)
        return error.error as ImportResult;
      throw error;
    }
  }

  async copyToDemo(id: string, version: string): Promise<DemoCopyResult> {
    const url = `/api/formations/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/copie-demo`;
    try {
      return await firstValueFrom(this.http.post<DemoCopyResult>(url, {}));
    } catch (error) {
      if (error instanceof HttpErrorResponse && typeof error.error?.refus === 'string') {
        return error.error as DemoCopyResult;
      }
      throw error;
    }
  }

  async publish(id: string, version: string): Promise<PublishResult> {
    const url = `/api/formations/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/publication`;
    try {
      return await firstValueFrom(this.http.post<PublishResult>(url, {}));
    } catch (error) {
      if (error instanceof HttpErrorResponse && typeof error.error?.refus === 'string') {
        return error.error as PublishResult;
      }
      throw error;
    }
  }

  exportUrl(id: string, version: string): string {
    return `/api/formations/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/export`;
  }
}
