import type { Routes } from '@angular/router';

export const ermRoutes: Routes = [
  {
    path: 'erm-server/:unitId',
    data: { feature: 'erm-server', requiresBranch: false },
    loadComponent: () => import('./erm-workspace').then((module) => module.ErmWorkspace),
  },
  {
    path: 'erm-server',
    data: { feature: 'erm-server', requiresBranch: false },
    loadComponent: () => import('./erm-workspace').then((module) => module.ErmWorkspace),
  },
];
