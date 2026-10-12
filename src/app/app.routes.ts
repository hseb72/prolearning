import type { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { anonymousGuard, authGuard, roleGuard } from './core/guards';
import { LABELS } from './labels';
import { LearningService } from './learning/learning.service';
import { PREVIEW_MODE, READER_MODE } from './learning/reader-mode';

const title = (page: string) => `${page} — ${LABELS.app.name}`;

/** « /catalogue » et « /catalogue/:id » (sauf « nouvelle »), sur la même route. */
export function catalogMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'catalogue') return null;
  if (segments.length === 1) return { consumed: segments };
  if (segments.length === 2 && segments[1]!.path !== 'nouvelle') {
    return { consumed: segments, posParams: { id: segments[1]! } };
  }
  return null;
}

export const routes: Routes = [
  {
    path: 'connexion',
    title: title(LABELS.login.title),
    canActivate: [anonymousGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  // Le portail s'ouvre sur le catalogue (pas de page d'accueil, comme le prototype).
  { path: '', pathMatch: 'full', redirectTo: 'catalogue' },
  { path: 'administration', pathMatch: 'full', redirectTo: 'administration/demandes' },
  { path: 'demandes/a-traiter', pathMatch: 'full', redirectTo: 'administration/demandes' },
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
    // /catalogue et /catalogue/:id partagent la même page : la fiche s'ouvre en dialogue
    // par-dessus le catalogue, sans le recharger.
    matcher: catalogMatcher,
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
    path: 'catalogue/:id/sessions',
    title: title(LABELS.catalog.sessionsHeading),
    canActivate: [roleGuard('training')],
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
    path: 'administration/demandes',
    title: title(LABELS.requests.queueTitle),
    canActivate: [roleGuard('training')],
    loadComponent: () => import('./pages/requests/queue').then((m) => m.RequestQueuePage),
  },
  // Relecture d'une formation en évaluation : le lecteur, en aperçu (rien n'est enregistré).
  {
    path: 'administration/evaluation',
    canActivate: [roleGuard('admin')],
    providers: [LearningService, { provide: READER_MODE, useValue: PREVIEW_MODE }],
    children: [
      {
        path: ':formation',
        title: title(LABELS.formations.review),
        loadComponent: () =>
          import('./pages/learning/formation').then((m) => m.LearningFormationPage),
      },
      {
        path: ':formation/:module/:activite',
        title: title(LABELS.formations.review),
        loadComponent: () =>
          import('./pages/learning/activity').then((m) => m.LearningActivityPage),
      },
    ],
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
    // Bibliothèque de composants (SPEC-UI § 4), page interne non listée dans les onglets.
    path: 'administration/composants',
    title: title('Composants'),
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/components/components').then((m) => m.ComponentsPage),
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
