import type { Routes } from '@angular/router';

export const devRoutes: Routes = [
  {
    path: ':language/design',
    loadComponent: () => import('./design/design-page').then((module) => module.DesignPage),
  },
];
