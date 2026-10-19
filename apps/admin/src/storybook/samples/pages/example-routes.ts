import type { Routes } from '@angular/router';
import { leaveDrawer } from '../../../app/ui/drawer/leave-drawer.guard';
import { AlertsPage } from './alerts-page';
import { DevicesPage } from './devices-page';
import { DriversPage } from './drivers-page';
import { DriverScorecardPage } from './driver-scorecard-page';
import { GeneralSettingsPage } from './general-settings-page';
import { GroupsPage } from './groups-page';
import { MaintenancePage } from './maintenance-page';
import { OverviewPage } from './overview-page';
import { TripsPage } from './trips-page';
import { VehicleProfilePage } from './vehicle-profile-page';
import { VehiclesPage } from './vehicles-page';

/** Routes of the example app (story-only); each page keeps its own sample state. */
export const exampleRoutes: Routes = [
  { path: 'examples/overview', component: OverviewPage, data: { title: 'Overview' } },
  {
    path: 'examples/alerts',
    component: AlertsPage,
    canDeactivate: [leaveDrawer],
    data: { title: 'Alerts' },
  },
  { path: 'examples/trips', component: TripsPage, data: { title: 'Trips' } },
  {
    path: 'examples/vehicles',
    component: VehiclesPage,
    canDeactivate: [leaveDrawer],
    data: { title: 'Vehicles' },
  },
  {
    path: 'examples/vehicles/:id',
    component: VehicleProfilePage,
    canDeactivate: [leaveDrawer],
    data: { title: 'Vehicle profile' },
  },
  {
    path: 'examples/drivers',
    component: DriversPage,
    canDeactivate: [leaveDrawer],
    data: { title: 'Drivers' },
  },
  {
    path: 'examples/drivers/:id/scorecard',
    component: DriverScorecardPage,
    data: { title: 'Driver scorecard' },
  },
  {
    path: 'examples/devices',
    component: DevicesPage,
    canDeactivate: [leaveDrawer],
    data: { title: 'Devices' },
  },
  {
    path: 'examples/maintenance',
    component: MaintenancePage,
    canDeactivate: [leaveDrawer],
    data: { title: 'Maintenance' },
  },
  {
    path: 'examples/settings/groups',
    component: GroupsPage,
    canDeactivate: [leaveDrawer],
    data: { title: 'Vehicle groups' },
  },
  {
    path: 'examples/settings/general',
    component: GeneralSettingsPage,
    canDeactivate: [leaveDrawer],
    data: { title: 'General settings' },
  },
  { path: '**', redirectTo: 'examples/overview' },
];
