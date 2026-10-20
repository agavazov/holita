import type { Routes, UrlMatcher } from '@angular/router';
import { leaveDrawer } from '../../ui/drawer/leave-drawer.guard';

const vehicleProfileRoute: UrlMatcher = (segments) => {
  const [branchId, fleet, vehicles, recordId, tab] = segments;
  if (
    !branchId ||
    fleet?.path !== 'fleet' ||
    vehicles?.path !== 'vehicles' ||
    !recordId ||
    !tab ||
    !['overview', 'trips', 'alerts', 'service'].includes(tab.path)
  ) {
    return null;
  }
  return { consumed: segments.slice(0, 5), posParams: { branchId, recordId, tab } };
};

export const fleetRoutes: Routes = [
  { path: ':branchId/fleet', pathMatch: 'full', redirectTo: ':branchId/fleet/overview' },
  {
    path: ':branchId/fleet/settings/general',
    data: { resource: 'general' },
    canDeactivate: [leaveDrawer],
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  {
    matcher: vehicleProfileRoute,
    data: { resource: 'vehicle-profile' },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
    children: [
      {
        path: 'trips/:recordId',
        data: { drawer: true, mode: 'view', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./trips/trip-detail-page').then((module) => module.TripDetailPage),
      },
      {
        path: 'alerts/:recordId',
        data: { drawer: true, mode: 'view', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./alerts/alert-detail-page').then((module) => module.AlertDetailPage),
      },
      {
        path: 'service/:recordId/edit',
        data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./maintenance/maintenance-record-page').then(
            (module) => module.MaintenanceRecordPage,
          ),
      },
      {
        path: 'service/:recordId',
        data: { drawer: true, mode: 'view', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./maintenance/maintenance-record-page').then(
            (module) => module.MaintenanceRecordPage,
          ),
      },
      {
        path: 'edit',
        data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./vehicles/vehicle-editor-page').then((module) => module.VehicleEditorPage),
      },
      {
        path: 'odometer',
        data: { drawer: true, mode: 'create' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./vehicles/vehicle-odometer-page').then((module) => module.VehicleOdometerPage),
      },
    ],
  },
  {
    path: ':branchId/fleet/maintenance',
    data: { resource: 'maintenance' },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
    children: [
      {
        path: 'new',
        data: { drawer: true, mode: 'create' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./maintenance/maintenance-record-page').then(
            (module) => module.MaintenanceRecordPage,
          ),
      },
      {
        path: ':recordId/complete',
        data: { drawer: true, mode: 'view', recordParam: 'recordId', action: 'complete' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./maintenance/maintenance-record-page').then(
            (module) => module.MaintenanceRecordPage,
          ),
      },
      {
        path: ':recordId/edit',
        data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./maintenance/maintenance-record-page').then(
            (module) => module.MaintenanceRecordPage,
          ),
      },
      {
        path: ':recordId',
        data: { drawer: true, mode: 'view', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./maintenance/maintenance-record-page').then(
            (module) => module.MaintenanceRecordPage,
          ),
      },
    ],
  },
  {
    path: ':branchId/fleet/drivers/:recordId/scorecard',
    data: { resource: 'driver-scorecard', editor: false },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  {
    path: ':branchId/fleet/drivers',
    data: { resource: 'drivers', editor: false },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
    children: [
      {
        path: 'new',
        data: { drawer: true, mode: 'create' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./drivers/driver-editor-page').then((module) => module.DriverEditorPage),
      },
      {
        path: ':recordId/edit',
        data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./drivers/driver-editor-page').then((module) => module.DriverEditorPage),
      },
      {
        path: ':recordId',
        data: { drawer: true, mode: 'view', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./drivers/driver-editor-page').then((module) => module.DriverEditorPage),
      },
    ],
  },
  {
    path: ':branchId/fleet/trips',
    data: { resource: 'trips', editor: false },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
    children: [
      {
        path: ':recordId',
        data: { drawer: true, mode: 'view', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./trips/trip-detail-page').then((module) => module.TripDetailPage),
      },
    ],
  },
  {
    path: ':branchId/fleet/overview',
    data: { resource: 'overview', editor: false },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
  },
  {
    path: ':branchId/fleet/alerts',
    data: { resource: 'alerts', editor: false },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
    children: [
      {
        path: ':recordId',
        data: { drawer: true, mode: 'view', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./alerts/alert-detail-page').then((module) => module.AlertDetailPage),
      },
    ],
  },
  {
    path: ':branchId/fleet/settings/groups',
    data: { resource: 'groups', editor: false },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
    children: [
      {
        path: 'new',
        data: { drawer: true, mode: 'create' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./vehicle-groups/vehicle-group-editor-page').then(
            (module) => module.VehicleGroupEditorPage,
          ),
      },
      {
        path: ':recordId/edit',
        data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./vehicle-groups/vehicle-group-editor-page').then(
            (module) => module.VehicleGroupEditorPage,
          ),
      },
    ],
  },
  {
    path: ':branchId/fleet/vehicles',
    data: { resource: 'vehicles', editor: false },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
    children: [
      {
        path: 'new',
        data: { drawer: true, mode: 'create' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./vehicles/vehicle-editor-page').then((module) => module.VehicleEditorPage),
      },
      {
        path: ':recordId/edit',
        data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./vehicles/vehicle-editor-page').then((module) => module.VehicleEditorPage),
      },
    ],
  },
  {
    path: ':branchId/fleet/devices',
    data: { resource: 'devices', editor: false },
    loadComponent: () => import('./fleet-workspace').then((module) => module.FleetWorkspace),
    children: [
      {
        path: 'new',
        data: { drawer: true, mode: 'create' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./devices/device-editor-page').then((module) => module.DeviceEditorPage),
      },
      {
        path: ':recordId/edit',
        data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./devices/device-editor-page').then((module) => module.DeviceEditorPage),
      },
      {
        path: ':recordId/diagnostics',
        data: { drawer: true, mode: 'view', recordParam: 'recordId' },
        canDeactivate: [leaveDrawer],
        loadComponent: () =>
          import('./devices/device-diagnostics-page').then(
            (module) => module.DeviceDiagnosticsPage,
          ),
      },
    ],
  },
  { path: ':branchId/reference', redirectTo: ':branchId/fleet' },
];
