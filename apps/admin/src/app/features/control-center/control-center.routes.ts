import type { Routes } from '@angular/router';

export const controlCenterRoutes: Routes = [
  {
    path: ':branchId/control-center/devices/:recordId',
    pathMatch: 'full',
    redirectTo: ':branchId/control-center/devices/:recordId/overview',
  },
  {
    path: ':branchId/control-center/devices/:recordId/:tab',
    loadComponent: () =>
      import('./control-center-workspace').then((module) => module.ControlCenterWorkspace),
  },
  {
    path: ':branchId/control-center',
    loadComponent: () =>
      import('./control-center-workspace').then((module) => module.ControlCenterWorkspace),
  },
];
