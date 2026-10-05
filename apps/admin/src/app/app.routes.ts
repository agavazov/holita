import { inject } from '@angular/core';
import { Router, type Routes, type CanDeactivateFn } from '@angular/router';
import type { StoreProducts } from './features/products/store-products';

const leaveProducts: CanDeactivateFn<StoreProducts> = (component) => component.canLeave();

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
