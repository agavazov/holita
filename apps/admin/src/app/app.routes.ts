import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import { fleetRoutes } from './features/fleet/fleet.routes';
import { karmaRoutes } from './features/karma-client/karma.routes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'bg' },
  {
    path: ':language',
    canActivate: [
      (route) =>
        ['bg', 'en'].includes(String(route.paramMap.get('language'))) ||
        inject(Router).createUrlTree(['/bg']),
    ],
    loadComponent: () =>
      import('./workspace/admin-workspace').then((module) => module.AdminWorkspace),
    children: [...karmaRoutes, ...fleetRoutes, { path: '**', redirectTo: '' }],
  },
];
