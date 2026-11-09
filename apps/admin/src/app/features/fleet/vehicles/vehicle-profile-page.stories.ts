import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { fixtureVehicleProfile } from '../../../../storybook/vehicle-profile-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { AlertDetailPage } from '../alerts/alert-detail-page';
import { FleetWorkspace } from '../fleet-workspace';
import { MaintenanceRecordPage } from '../maintenance/maintenance-record-page';
import { TripDetailPage } from '../trips/trip-detail-page';
import { VehicleEditorPage } from './vehicle-editor-page';
import { VehicleOdometerPage } from './vehicle-odometer-page';
import { VehicleProfilePage } from './vehicle-profile-page';

const meta: Meta = {
  title: 'Admin/Fleet/Vehicles/Vehicle detail',
  tags: ['!autodocs'],
  parameters: { discocan: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = defaultBranchId + '/fleet/vehicles/' + fixtureVehicleProfile.id;
function routed(tab = 'overview', child = ''): NonNullable<Story['render']> {
  const render = routeAt(path + '/' + tab + child);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [
        StoryApp,
        AdminWorkspace,
        FleetWorkspace,
        VehicleProfilePage,
        VehicleEditorPage,
        VehicleOdometerPage,
        TripDetailPage,
        AlertDetailPage,
        MaintenanceRecordPage,
      ],
    },
    template: '<discocan-story-app [url]="url" />',
  });
}
export const Overview: Story = {
  render: routed(),
};
export const Problems: Story = {
  render: routed('problems'),
};
export const Trips: Story = {
  render: routed('trips'),
};
export const Maintenance: Story = {
  render: routed('maintenance'),
};
export const Commands: Story = {
  render: routed('commands'),
};
export const Narrow: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  render: routed(),
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    discocan: { scenario: { failures: { AdminVehicleProfile: 'network' } } } satisfies StoryFixtures,
  },
};
export const NotFound: Story = {
  name: 'Not found',
  render: routed(),
  parameters: {
    discocan: {
      scenario: { failures: { AdminVehicleProfile: 'not-found' } },
    } satisfies StoryFixtures,
  },
};
