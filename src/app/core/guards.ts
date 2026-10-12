import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import type { Role } from '@shared/roles';
import { AuthService } from './auth';

/** Page réservée aux personnes connectées ; sinon, connexion puis retour ici. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.load()) return true;
  return router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
};

/** Page réservée à un rôle minimal (celui du compte joué en démonstration). */
export function roleGuard(role: Role): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!(await auth.load())) {
      return router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
    }
    return auth.hasRole(role) ? true : router.createUrlTree(['/acces-refuse']);
  };
}

/** La page de connexion n'a pas de sens pour une personne déjà connectée. */
export const anonymousGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.load()) ? router.createUrlTree(['/']) : true;
};
