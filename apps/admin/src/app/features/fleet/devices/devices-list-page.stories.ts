import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureDevice } from '../../../../storybook/devices-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { DeviceDiagnosticsPage } from './device-diagnostics-page';
import { DeviceEditorPage } from './device-editor-page';
import { DevicesPage } from './devices-list-page';

const meta: Meta = {
  title: 'Admin/Fleet/Devices',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = defaultBranchId + '/fleet/devices';
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [
        StoryApp,
        AdminWorkspace,
        FleetWorkspace,
        DevicesPage,
        DeviceEditorPage,
        DeviceDiagnosticsPage,
      ],
    },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
};
export const Edit: Story = {
  render: routed('/' + fixtureDevice.id + '/edit'),
};

export const Stock: Story = {
  render: routed('/new'),
};
export const Diagnostics: Story = {
  render: routed('/' + fixtureDevice.id + '/diagnostics'),
};
export const ErrorState: Story = {
  name: 'Error',
  parameters: {
    holita: { scenario: { failures: { AdminDevices: 'network' } } } satisfies StoryFixtures,
  },
  render: routed(),
};
