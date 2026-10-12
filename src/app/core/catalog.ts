import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CourseDetail, CourseInput, SessionInput, SessionView } from '@shared/catalog';
import { firstValueFrom } from 'rxjs';

/** Gestion du catalogue et des sessions (équipe formation), dans l'espace actif. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  createCourse(input: CourseInput): Promise<CourseDetail> {
    return firstValueFrom(this.http.post<CourseDetail>('/api/catalogue', input));
  }

  updateCourse(id: string, input: Omit<CourseInput, 'id'>): Promise<CourseDetail> {
    return firstValueFrom(
      this.http.put<CourseDetail>(`/api/catalogue/${encodeURIComponent(id)}`, input),
    );
  }

  addSession(courseId: string, input: SessionInput): Promise<SessionView> {
    return firstValueFrom(
      this.http.post<SessionView>(`/api/catalogue/${encodeURIComponent(courseId)}/sessions`, input),
    );
  }

  updateSession(id: number, input: SessionInput): Promise<SessionView> {
    return firstValueFrom(this.http.put<SessionView>(`/api/sessions/${id}`, input));
  }

  cancelSession(id: number): Promise<SessionView> {
    return firstValueFrom(this.http.post<SessionView>(`/api/sessions/${id}/annulation`, {}));
  }
}
