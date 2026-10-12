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
    path: 'parcours',
    title: title(LABELS.learning.title),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/learning/learning-list').then((m) => m.LearningListPage),
  },
  {
    path: 'parcours/:formation',
    title: title(LABELS.learning.title),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/learning/formation').then((m) => m.LearningFormationPage),
  },
  {
    path: 'parcours/:formation/:module/:activite',
    title: title(LABELS.learning.title),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/learning/activity').then((m) => m.LearningActivityPage),
  },
  {
    path: 'catalogue',
    title: title(LABELS.catalog.title),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/catalog/catalog').then((m) => m.CatalogPage),
  },
  {
    path: 'catalogue/nouvelle',
    title: title(LABELS.catalog.newTitle),
    canActivate: [roleGuard('training')],
    loadComponent: () => import('./pages/catalog/course-form').then((m) => m.CourseFormPage),
  },
  {
    path: 'catalogue/:id',
    title: title(LABELS.catalog.title),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/catalog/course').then((m) => m.CoursePage),
  },
  {
    path: 'catalogue/:id/modifier',
    title: title(LABELS.catalog.edit),
    canActivate: [roleGuard('training')],
    loadComponent: () => import('./pages/catalog/course-form').then((m) => m.CourseFormPage),
  },
  {
    path: 'sessions',
    title: title(LABELS.sessions.title),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/catalog/sessions').then((m) => m.SessionsPage),
  },
  {
    path: 'demandes',
    title: title(LABELS.requests.mineTitle),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/requests/my-requests').then((m) => m.MyRequestsPage),
  },
  {
    path: 'demandes/sur-mesure',
    title: title(LABELS.requests.customTitle),
    canActivate: [roleGuard('manager')],
    loadComponent: () =>
      import('./pages/requests/custom-form').then((m) => m.CustomRequestFormPage),
  },
  {
    path: 'demandes/equipe',
    title: title(LABELS.requests.teamTitle),
    canActivate: [roleGuard('manager')],
    loadComponent: () => import('./pages/requests/team').then((m) => m.TeamRequestsPage),
  },
  {
    path: 'demandes/a-traiter',
    title: title(LABELS.requests.queueTitle),
    canActivate: [roleGuard('training')],
    loadComponent: () => import('./pages/requests/queue').then((m) => m.RequestQueuePage),
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
