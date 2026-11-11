import { UrlSegment, type Routes, type UrlMatcher } from '@angular/router';
import { legacyFleetRoute, redirectLegacyAdminUrl } from '../../workspace/legacy-admin-redirect';
import { leaveDrawer } from '../../ui/drawer/leave-drawer.guard';

const vehicleProfileRoute: UrlMatcher = (segments) => {
  const [branchId, fleet, vehicles, recordId, tab] = segments;
  if (
    !branchId ||
    fleet?.path !== 'fleet' ||
    vehicles?.path !== 'vehicles' ||
    !recordId ||
    !tab ||
    !['overview', 'trips', 'problems', 'parameters', 'maintenance', 'commands'].includes(tab.path)
  ) {
    return null;
  }
  return {
    consumed: segments.slice(0, 5),
    posParams: { branchId, recordId, tab },
  };
};

const deviceProfileRoute: UrlMatcher = (segments) => {
  const [branchId, fleet, devices, recordId, tab, detail] = segments;
  if (!branchId || fleet?.path !== 'fleet' || devices?.path !== 'devices' || !recordId || !tab) {
    return null;
  }
  const canonicalTab =
    tab.path === 'technical-details' && (detail?.path === 'events' || detail?.path === 'frames')
      ? detail.path
      : ['overview', 'problems', 'commands', 'console', 'sms-commands', 'parameters'].includes(
            tab.path,
          )
        ? tab.path
        : null;
  if (!canonicalTab || recordId.path === 'new') {
    return null;
  }
  return {
    consumed: segments.slice(0, tab.path === 'technical-details' ? 6 : 5),
    posParams: { branchId, recordId, tab: new UrlSegment(canonicalTab, tab.parameters) },
  };
};

export const fleetRoutes: Routes = [
  { matcher: legacyFleetRoute, canMatch: [redirectLegacyAdminUrl], children: [] },
  {
    path: ':branchId/fleet/notifications',
    loadComponent: () =>
      import('../notifications/notifications-page').then((module) => module.NotificationsPage),
  },
  {
    matcher: deviceProfileRoute,
    data: { resource: 'control-center' },
    loadComponent: () =>
      import('../control-center/control-center-workspace').then(
        (module) => module.ControlCenterWorkspace,
      ),
  },
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
    path: ':branchId/fleet/geo-zones',
    data: { resource: 'geo-zones', editor: false },
    loadComponent: () =>
      import('./geo-zones/geo-zones-workspace').then((module) => module.GeoZonesWorkspace),
  },
  {
    path: ':branchId/fleet/live',
    data: { resource: 'live', editor: false },
    loadComponent: () =>
      import('./live-dashboard/live-dashboard-workspace').then(
        (module) => module.LiveDashboardWorkspace,
      ),
  },
  {
    path: ':branchId/fleet/dashboard/trips',
    data: { resource: 'trips', dashboardTab: 'trips', editor: false },
    loadComponent: () =>
      import('../../workspace/dashboard-workspace').then((module) => module.DashboardWorkspace),
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
    path: ':branchId/fleet/dashboard/overview',
    data: { resource: 'overview', dashboardTab: 'overview', editor: false },
    loadComponent: () =>
      import('../../workspace/dashboard-workspace').then((module) => module.DashboardWorkspace),
  },
  {
    path: ':branchId/fleet/dashboard/problems',
    data: { resource: 'alerts', dashboardTab: 'problems', editor: false },
    loadComponent: () =>
      import('../../workspace/dashboard-workspace').then((module) => module.DashboardWorkspace),
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
    loadComponent: () =>
      import('../../workspace/devices-workspace').then((module) => module.DevicesWorkspace),
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
    ],
  },
];
