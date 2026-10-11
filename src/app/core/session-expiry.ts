import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth';

/** Une réponse 401 en cours de route signifie une session perdue : retour à la connexion. */
export const sessionExpiryInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(request).pipe(
    catchError((error: unknown) => {
      const sessionCheck = request.url === '/api/auth/me';
      if (error instanceof HttpErrorResponse && error.status === 401 && !sessionCheck) {
        auth.forget();
        void router.navigate(['/connexion'], { queryParams: { retour: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
