import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, Injectable } from '@angular/core';
import type { HealthReport } from '@shared/health';

export type ServiceState = 'checking' | 'ok' | 'degraded' | 'down';

/** État du service, lu sur GET /api/health (relayé par nginx puis Kong). */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly report = httpResource<HealthReport>(() => '/api/health');

  readonly state = computed<ServiceState>(() => {
    if (this.report.isLoading()) return 'checking';
    const error = this.report.error();
    if (error) {
      // 503 : l'API répond mais une base est injoignable ; le corps porte le détail.
      return error instanceof HttpErrorResponse && error.status === 503 ? 'degraded' : 'down';
    }
    return this.report.value()?.status === 'ok' ? 'ok' : 'degraded';
  });
}
