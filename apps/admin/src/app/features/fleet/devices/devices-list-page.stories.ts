import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureDevice } from '../../../../storybook/devices-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { DeviceEditorPage } from './device-editor-page';
import { DevicesPage } from './devices-list-page';

const meta: Meta = {
  title: 'Admin/Devices/List',
  tags: ['!autodocs'],
  parameters: { discocan: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = defaultBranchId + '/fleet/devices';
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [StoryApp, AdminWorkspace, FleetWorkspace, DevicesPage, DeviceEditorPage],
    },
    template: '<discocan-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
};
export const Edit: Story = {
  render: routed('/' + fixtureDevice.id + '/edit'),
};

export const Loading: Story = {
  parameters: {
    discocan: { scenario: { failures: { AdminDevices: 'pending' } } } satisfies StoryFixtures,
  },
  render: routed(),
};
export const DelayedLiveState: Story = {
  name: 'Waiting for live state',
  parameters: {
    discocan: { scenario: { failures: { AdminDevicesLive: 'pending' } } } satisfies StoryFixtures,
  },
  render: routed(),
};
export const NoResults: Story = {
  render: routed('?search=no-device-results'),
};
export const Narrow: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  render: routed(),
};
export const LiveError: Story = {
  name: 'Live state unavailable',
  parameters: {
    discocan: { scenario: { failures: { AdminDevicesLive: 'network' } } } satisfies StoryFixtures,
  },
  render: routed(),
};
export const ErrorState: Story = {
  name: 'Error',
  parameters: {
    discocan: { scenario: { failures: { AdminDevices: 'network' } } } satisfies StoryFixtures,
  },
  render: routed(),
};
