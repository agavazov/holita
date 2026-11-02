import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { fixtureVehicle } from '../../../../storybook/vehicles-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { VehicleEditorPage } from './vehicle-editor-page';
import { VehicleProfilePage } from './vehicle-profile-page';

/** Real routes, page adapters, scoped Apollo clients and the shared Storybook presentation. */
const meta: Meta = {
  title: 'Admin/Fleet/Vehicles',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};

export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/vehicles`;

function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [StoryApp, AdminWorkspace, FleetWorkspace, VehicleEditorPage, VehicleProfilePage],
    },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = {
  render: routed(),
};

export const Edit: Story = {
  render: routed(`/${fixtureVehicle.id}/edit?keep=storybook#vehicles`),
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminVehicles: 'network' } } } satisfies StoryFixtures,
  },
};
