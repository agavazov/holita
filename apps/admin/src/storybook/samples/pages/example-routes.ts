import type { Routes } from '@angular/router';
import { AlertsPage } from './alerts-page';
import { DevicesPage } from './devices-page';
import { DriversPage } from './drivers-page';
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
  { path: 'examples/alerts', component: AlertsPage, data: { title: 'Alerts' } },
  { path: 'examples/trips', component: TripsPage, data: { title: 'Trips' } },
  { path: 'examples/vehicles', component: VehiclesPage, data: { title: 'Vehicles' } },
  {
    path: 'examples/vehicles/:id',
    component: VehicleProfilePage,
    data: { title: 'Vehicle profile' },
  },
  { path: 'examples/drivers', component: DriversPage, data: { title: 'Drivers' } },
  { path: 'examples/devices', component: DevicesPage, data: { title: 'Devices' } },
  { path: 'examples/maintenance', component: MaintenancePage, data: { title: 'Maintenance' } },
  { path: 'examples/settings/groups', component: GroupsPage, data: { title: 'Vehicle groups' } },
  {
    path: 'examples/settings/general',
    component: GeneralSettingsPage,
    data: { title: 'General settings' },
  },
  { path: '**', redirectTo: 'examples/overview' },
];
