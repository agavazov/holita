import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';

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
        path: 'stores/:storeId/products',
        loadComponent: () =>
          import('./features/products/store-products').then((module) => module.StoreProducts),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
