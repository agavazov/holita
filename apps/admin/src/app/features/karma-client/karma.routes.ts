import type { Routes } from '@angular/router';

export const karmaRoutes: Routes = [
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
    data: { feature: 'karma-client', requiresBranch: false, section: 'users' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/roles',
    data: { feature: 'karma-client', requiresBranch: false, section: 'roles' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/projects',
    data: { feature: 'karma-client', requiresBranch: false, section: 'projects' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/time-zones',
    data: { feature: 'karma-client', requiresBranch: false, section: 'time-zones' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
  },
  {
    path: 'karma-client/api-info',
    data: { feature: 'karma-client', requiresBranch: false, section: 'api-info' },
    loadComponent: () => import('./karma-workspace').then((module) => module.KarmaWorkspace),
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
