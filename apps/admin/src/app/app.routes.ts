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
        path: 'karma-client/cars/:recordId/trips',
        data: { feature: 'karma-client', section: 'trips' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/cars/:recordId/events',
        data: { feature: 'karma-client', section: 'events' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/cars/:recordId/driving-profile',
        data: { feature: 'karma-client', section: 'driving-profile' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/cars/:recordId/location',
        data: { feature: 'karma-client', section: 'location' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/users',
        data: { feature: 'karma-client', section: 'users' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/roles',
        data: { feature: 'karma-client', section: 'roles' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/projects',
        data: { feature: 'karma-client', section: 'projects' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/time-zones',
        data: { feature: 'karma-client', section: 'time-zones' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/api-info',
        data: { feature: 'karma-client', section: 'api-info' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/cars/:recordId/edata',
        data: { feature: 'karma-client', edata: true },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/cars/:recordId',
        data: { feature: 'karma-client' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
      {
        path: 'karma-client/cars',
        data: { feature: 'karma-client' },
        loadComponent: () =>
          import('./features/karma-client/karma-workspace').then((module) => module.KarmaWorkspace),
      },
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
