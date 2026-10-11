import { Routes } from '@angular/router';
import { LABELS } from './labels';

export const routes: Routes = [
  {
    path: '',
    title: LABELS.app.name,
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  {
    path: '**',
    title: `${LABELS.notFound.title} — ${LABELS.app.name}`,
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundPage),
  },
];
