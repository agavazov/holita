import { inject } from '@angular/core';
import { Router, type Routes, type CanDeactivateFn } from '@angular/router';
import type { ReferenceWorkspace } from './features/reference/reference-workspace';

const leaveReference: CanDeactivateFn<ReferenceWorkspace> = (component) => component.canLeave();

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
      import('./features/stores/store-workspace').then((module) => module.StoreWorkspace),
    children: [
      {
        path: 'stores/:storeId/reference/vehicles/new',
        data: { resource: 'vehicles', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/vehicles/:recordId/edit',
        data: { resource: 'vehicles', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/vehicles',
        data: { resource: 'vehicles', editor: false },

        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/devices/new',
        data: { resource: 'devices', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/devices/:recordId/edit',
        data: { resource: 'devices', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/devices',
        data: { resource: 'devices', editor: false },

        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
