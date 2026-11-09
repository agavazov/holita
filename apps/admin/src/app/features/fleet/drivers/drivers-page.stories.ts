import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureDriver } from '../../../../storybook/drivers-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { VehicleProfilePage } from '../vehicles/vehicle-profile-page';
import { DriverEditorPage } from './driver-editor-page';
import { DriverScorecardPage } from './driver-scorecard-page';
import { DriversPage } from './drivers-page';

const meta: Meta = {
  title: 'Admin/Fleet/Drivers',
  tags: ['!autodocs'],
  parameters: { discocan: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/drivers`;

function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [
        StoryApp,
        AdminWorkspace,
        FleetWorkspace,
        DriversPage,
        DriverEditorPage,
        DriverScorecardPage,
        VehicleProfilePage,
      ],
    },
    template: '<discocan-story-app [url]="url" />',
  });
}

export const Default: Story = {
  render: routed(),
};

export const Loading: Story = {
  render: routed(),
  parameters: {
    discocan: { scenario: { failures: { AdminDrivers: 'pending' } } } satisfies StoryFixtures,
  },
};

export const NoResults: Story = {
  render: routed('?search=no-driver-results'),
};

export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const AssignedVehicle: Story = {
  name: 'Assigned vehicle profile',
  render: routed(`/${fixtureDriver.id}`),
};

export const Edit: Story = {
  render: routed(`/${fixtureDriver.id}/edit?keep=drivers#drivers`),
};

export const ScorecardPeriods: Story = {
  name: 'Demo scorecard',
  render: routed(`/${fixtureDriver.id}/scorecard?days=30&keep=drivers&page=2#drivers`),
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    discocan: { scenario: { failures: { AdminDrivers: 'network' } } } satisfies StoryFixtures,
  },
};
