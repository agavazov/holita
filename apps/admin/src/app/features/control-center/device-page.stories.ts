import type { Meta, StoryObj } from '@storybook/angular-vite';
import { reportingDeviceId } from '../../../storybook/control-center-fixtures';
import { fixtureDevice } from '../../../storybook/devices-fixtures';
import { defaultBranchId } from '../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { ControlCenterWorkspace } from './control-center-workspace';
import { DevicePage, type DeviceTab } from './device-page';

const meta: Meta = {
  title: 'Admin/Fleet/Devices/Device',
  tags: ['!autodocs'],
  parameters: {
    holita: { signedIn: true, now: '2026-10-20T08:00:05.000Z' } satisfies StoryFixtures,
  },
};
export default meta;
type Story = StoryObj;
function routed(tab: DeviceTab, recordId = fixtureDevice.id): NonNullable<Story['render']> {
  const render = routeAt(`${defaultBranchId}/control-center/devices/${recordId}/${tab}`);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, ControlCenterWorkspace, DevicePage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Overview: Story = { render: routed('overview') };
export const Reporting: Story = { render: routed('overview', reportingDeviceId) };
export const Diagnostics: Story = { render: routed('alarms') };
export const Events: Story = { render: routed('events') };
export const Commands: Story = { render: routed('commands') };
export const Parameters: Story = { render: routed('parameters') };
export const Sms: Story = { render: routed('sms') };
export const ErrorState: Story = {
  name: 'Error',
  parameters: {
    holita: {
      scenario: { failures: { AdminControlCenterDevice: 'network' } },
    } satisfies StoryFixtures,
  },
  render: routed('overview'),
};
