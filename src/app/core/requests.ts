import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CustomCreate,
  CustomProcessing,
  CustomRequestView,
  Decision,
  RegistrationRequestView,
} from '@shared/requests';
import { firstValueFrom } from 'rxjs';

/** Message d'erreur de l'API s'il y en a un, sinon `fallback`. */
export function apiMessage(error: unknown, fallback: string): string {
  const message = error instanceof HttpErrorResponse ? error.error?.message : null;
  return typeof message === 'string' ? message : fallback;
}

/** Demandes d'inscription et de sessions sur mesure, dans l'espace actif. */
@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly http = inject(HttpClient);

  register(sessionId: number, motif: string): Promise<RegistrationRequestView> {
    return firstValueFrom(
      this.http.post<RegistrationRequestView>('/api/demandes/inscriptions', { sessionId, motif }),
    );
  }

  cancelRegistration(id: number): Promise<RegistrationRequestView> {
    return firstValueFrom(
      this.http.post<RegistrationRequestView>(`/api/demandes/inscriptions/${id}/annulation`, {}),
    );
  }

  managerDecision(id: number, decision: Decision): Promise<RegistrationRequestView> {
    return firstValueFrom(
      this.http.post<RegistrationRequestView>(
        `/api/demandes/inscriptions/${id}/avis-manager`,
        decision,
      ),
    );
  }

  trainingDecision(id: number, decision: Decision): Promise<RegistrationRequestView> {
    return firstValueFrom(
      this.http.post<RegistrationRequestView>(
        `/api/demandes/inscriptions/${id}/decision`,
        decision,
      ),
    );
  }

  createCustom(input: CustomCreate): Promise<CustomRequestView> {
    return firstValueFrom(this.http.post<CustomRequestView>('/api/demandes/sur-mesure', input));
  }

  cancelCustom(id: number): Promise<CustomRequestView> {
    return firstValueFrom(
      this.http.post<CustomRequestView>(`/api/demandes/sur-mesure/${id}/annulation`, {}),
    );
  }

  processCustom(id: number, input: CustomProcessing): Promise<CustomRequestView> {
    return firstValueFrom(
      this.http.post<CustomRequestView>(`/api/demandes/sur-mesure/${id}/traitement`, input),
    );
  }
}
