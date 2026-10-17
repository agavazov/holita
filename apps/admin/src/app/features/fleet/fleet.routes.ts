import type { CanDeactivateFn, Routes } from '@angular/router';
import type { FleetWorkspace } from './fleet-workspace';

// Signed-out routes have no mounted editor; only active editors can guard navigation.
const leaveFleet: CanDeactivateFn<FleetWorkspace | null> = (component) =>
  component?.canLeave() ?? true;

export const fleetRoutes: Routes = [
  {
    path: ':branchId/fleet/vehicles/new',
    data: { resource: 'vehicles', editor: true },
    canDeactivate: [leaveFleet],
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  {
    path: ':branchId/fleet/vehicles/:recordId/edit',
    data: { resource: 'vehicles', editor: true },
    canDeactivate: [leaveFleet],
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  {
    path: ':branchId/fleet/vehicles',
    data: { resource: 'vehicles', editor: false },

    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  {
    path: ':branchId/fleet/devices/new',
    data: { resource: 'devices', editor: true },
    canDeactivate: [leaveFleet],
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  {
    path: ':branchId/fleet/devices/:recordId/edit',
    data: { resource: 'devices', editor: true },
    canDeactivate: [leaveFleet],
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  {
    path: ':branchId/fleet/devices',
    data: { resource: 'devices', editor: false },

    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  { path: ':branchId/reference', redirectTo: ':branchId/fleet' },
];
