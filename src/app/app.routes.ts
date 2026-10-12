import { Routes } from '@angular/router';
import { anonymousGuard, authGuard, roleGuard } from './core/guards';
import { LABELS } from './labels';

const title = (page: string) => `${page} — ${LABELS.app.name}`;

export const routes: Routes = [
  {
    path: 'connexion',
    title: title(LABELS.login.title),
    canActivate: [anonymousGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    title: LABELS.app.name,
    canActivate: [authGuard],
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  {
    path: 'administration/formations',
    title: title(LABELS.formations.title),
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/formations/formations').then((m) => m.FormationsPage),
  },
  {
    path: 'administration/comptes',
    title: title(LABELS.users.title),
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/users/users').then((m) => m.UsersPage),
  },
  {
    path: 'acces-refuse',
    title: title(LABELS.forbidden.title),
    loadComponent: () => import('./pages/forbidden/forbidden').then((m) => m.ForbiddenPage),
  },
  {
    path: '**',
    title: title(LABELS.notFound.title),
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundPage),
  },
];
