import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { fixtureVehicleGroups } from '../../../../storybook/vehicle-groups-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { VehicleGroupEditorPage } from './vehicle-group-editor-page';

const meta: Meta = {
  title: 'Admin/Settings/Vehicle groups',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/settings/groups`;
const regional = fixtureVehicleGroups.find((group) => group.name === 'Regional');
if (!regional) {
  throw new Error('Missing Regional group fixture.');
}
const editableGroup = regional;

function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, VehicleGroupEditorPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = {
  render: routed(),
};

export const SecondPage: Story = {
  render: routed('?page=2&pageSize=10&keep=storybook#groups'),
};

export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminVehicleGroupsList: 'pending' } },
    } satisfies StoryFixtures,
  },
};

export const Edit: Story = {
  render: routed(`/${editableGroup.id}/edit?keep=storybook#groups`),
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminVehicleGroupsList: 'network' } },
    } satisfies StoryFixtures,
  },
};
