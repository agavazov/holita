import { inject } from '@angular/core';
import { Router, type Routes, type CanDeactivateFn } from '@angular/router';
import type { FleetWorkspace } from './features/fleet/fleet-workspace';

// Signed-out routes have no mounted editor; only active editors can guard navigation.
const leaveFleet: CanDeactivateFn<FleetWorkspace | null> = (component) =>
  component?.canLeave() ?? true;

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
        path: ':storeId/fleet/vehicles/new',
        data: { resource: 'vehicles', editor: true },
        canDeactivate: [leaveFleet],
        loadComponent: () =>
          import('./features/fleet/fleet-workspace').then((module) => module.FleetWorkspace),
      },
      {
        path: ':storeId/fleet/vehicles/:recordId/edit',
        data: { resource: 'vehicles', editor: true },
        canDeactivate: [leaveFleet],
        loadComponent: () =>
          import('./features/fleet/fleet-workspace').then((module) => module.FleetWorkspace),
      },
      {
        path: ':storeId/fleet/vehicles',
        data: { resource: 'vehicles', editor: false },

        loadComponent: () =>
          import('./features/fleet/fleet-workspace').then((module) => module.FleetWorkspace),
      },
      {
        path: ':storeId/fleet/devices/new',
        data: { resource: 'devices', editor: true },
        canDeactivate: [leaveFleet],
        loadComponent: () =>
          import('./features/fleet/fleet-workspace').then((module) => module.FleetWorkspace),
      },
      {
        path: ':storeId/fleet/devices/:recordId/edit',
        data: { resource: 'devices', editor: true },
        canDeactivate: [leaveFleet],
        loadComponent: () =>
          import('./features/fleet/fleet-workspace').then((module) => module.FleetWorkspace),
      },
      {
        path: ':storeId/fleet/devices',
        data: { resource: 'devices', editor: false },

        loadComponent: () =>
          import('./features/fleet/fleet-workspace').then((module) => module.FleetWorkspace),
      },
      { path: ':storeId/reference', redirectTo: ':storeId/fleet' },
      { path: '**', redirectTo: '' },
    ],
  },
];
