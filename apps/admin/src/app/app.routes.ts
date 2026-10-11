import { inject } from '@angular/core';
import { Router, type Routes, type CanDeactivateFn } from '@angular/router';
import type { StoreProducts } from './features/products/store-products';
import type { ReferenceWorkspace } from './features/reference/reference-workspace';

const leaveProducts: CanDeactivateFn<StoreProducts> = (component) => component.canLeave();
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
        path: 'stores/:storeId/reference/events/:recordId/sessions/new',
        data: { resource: 'events', sessionEditor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/events/:recordId/sessions/:sessionId/edit',
        data: { resource: 'events', sessionEditor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/events/new',
        data: { resource: 'events', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/events/:recordId/edit',
        data: { resource: 'events', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/events/:recordId',
        data: { resource: 'events', overview: true },
        canDeactivate: [leaveReference],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',

        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/events',
        data: { resource: 'events', editor: false },

        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/venues/new',
        data: { resource: 'venues', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/venues/:venueId/edit',
        data: { resource: 'venues', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/venues',
        data: { resource: 'venues' },
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/speakers/new',
        data: { resource: 'speakers', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/speakers/:recordId/edit',
        data: { resource: 'speakers', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/speakers',
        data: { resource: 'speakers', editor: false },
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
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
      {
        path: 'stores/:storeId/reference/tags/new',
        data: { resource: 'tags', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/tags/:recordId/edit',
        data: { resource: 'tags', editor: true },
        canDeactivate: [leaveReference],
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/reference/tags',
        data: { resource: 'tags', editor: false },
        loadComponent: () =>
          import('./features/reference/reference-workspace').then(
            (module) => module.ReferenceWorkspace,
          ),
      },
      {
        path: 'stores/:storeId/products/new',
        data: { editor: true },
        canDeactivate: [leaveProducts],
        loadComponent: () =>
          import('./features/products/store-products').then((module) => module.StoreProducts),
      },
      {
        path: 'stores/:storeId/products/:productId/edit',
        data: { editor: true },
        canDeactivate: [leaveProducts],
        loadComponent: () =>
          import('./features/products/store-products').then((module) => module.StoreProducts),
      },
      {
        path: 'stores/:storeId/products',
        loadComponent: () =>
          import('./features/products/store-products').then((module) => module.StoreProducts),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
