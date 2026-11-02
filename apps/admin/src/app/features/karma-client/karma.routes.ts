import { inject } from '@angular/core';
import { Router, type RedirectFunction, type Routes } from '@angular/router';
import { leaveDrawer } from '../../ui/drawer/leave-drawer.guard';

function administrationRedirect(section: string): RedirectFunction {
  return ({ queryParams, fragment }) => {
    const router = inject(Router);
    return router
      .serializeUrl(
        router.createUrlTree(['karma-client', 'administration', section], {
          queryParams,
          ...(fragment === null ? {} : { fragment }),
        }),
      )
      .slice(1);
  };
}

export const karmaRoutes: Routes = [
  {
    path: 'karma-client/monitoring',
    pathMatch: 'full',
    redirectTo: 'karma-client/monitoring/trucks',
  },
  ...['trucks', 'faults', 'log'].map((section) => ({
    path: `karma-client/monitoring/${section}`,
    data: { feature: 'karma-client', requiresBranch: false, section },
    loadComponent: () =>
      import('./monitoring/monitoring-workspace').then((module) => module.MonitoringWorkspace),
  })),
  {
    path: 'karma-client/settings',
    data: { feature: 'karma-client', requiresBranch: false, section: 'settings' },
    canDeactivate: [leaveDrawer],
    loadComponent: () =>
      import('./monitoring/monitoring-workspace').then((module) => module.MonitoringWorkspace),
  },
  {
    path: 'karma-client/cars/:recordId/daily-report',
    data: { feature: 'karma-client', requiresBranch: false, section: 'daily-report' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/cars/:recordId/diagnostics',
    data: { feature: 'karma-client', requiresBranch: false, section: 'diagnostics' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/cars/:recordId/configuration',
    data: { feature: 'karma-client', requiresBranch: false, section: 'configuration' },
    canDeactivate: [leaveDrawer],
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/cars/:recordId/trips',
    data: { feature: 'karma-client', requiresBranch: false, section: 'trips' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/cars/:recordId/events',
    data: { feature: 'karma-client', requiresBranch: false, section: 'events' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/cars/:recordId/driving-profile',
    data: { feature: 'karma-client', requiresBranch: false, section: 'driving-profile' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/cars/:recordId/location',
    data: { feature: 'karma-client', requiresBranch: false, section: 'location' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/users',
    pathMatch: 'full',
    redirectTo: administrationRedirect('users'),
  },
  {
    path: 'karma-client/roles',
    pathMatch: 'full',
    redirectTo: administrationRedirect('roles'),
  },
  {
    path: 'karma-client/projects',
    pathMatch: 'full',
    redirectTo: administrationRedirect('projects'),
  },
  {
    path: 'karma-client/time-zones',
    pathMatch: 'full',
    redirectTo: administrationRedirect('time-zones'),
  },
  {
    path: 'karma-client/api-info',
    pathMatch: 'full',
    redirectTo: administrationRedirect('api-info'),
  },
  {
    path: 'karma-client/administration/users',
    data: {
      feature: 'karma-client',
      requiresBranch: false,
      administration: true,
      section: 'users',
    },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/administration/roles',
    data: {
      feature: 'karma-client',
      requiresBranch: false,
      administration: true,
      section: 'roles',
    },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/administration/projects',
    data: {
      feature: 'karma-client',
      requiresBranch: false,
      administration: true,
      section: 'projects',
    },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/administration/time-zones',
    data: {
      feature: 'karma-client',
      requiresBranch: false,
      administration: true,
      section: 'time-zones',
    },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/administration/api-info',
    data: {
      feature: 'karma-client',
      requiresBranch: false,
      administration: true,
      section: 'api-info',
    },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/administration',
    pathMatch: 'full',
    redirectTo: administrationRedirect('users'),
  },
  {
    path: 'karma-client/cars/:recordId/edata',
    data: { feature: 'karma-client', requiresBranch: false, edata: true },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/cars/:recordId',
    data: { feature: 'karma-client', requiresBranch: false },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/cars',
    data: { feature: 'karma-client', requiresBranch: false },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
];
