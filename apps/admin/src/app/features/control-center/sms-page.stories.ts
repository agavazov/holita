import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../storybook/control-center-fixtures';
import { fixtureDevice } from '../../../storybook/devices-fixtures';
import { defaultBranchId } from '../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { ControlCenterWorkspace } from './control-center-workspace';
import { SmsPage } from './sms-page';

const meta: Meta = {
  title: 'Admin/Devices/SMS commands',
  tags: ['!autodocs'],
  parameters: {
    holita: { signedIn: true, now: '2026-10-20T08:00:05.000Z' } satisfies StoryFixtures,
  },
};
export default meta;
type Story = StoryObj;
function routed(): NonNullable<Story['render']> {
  const render = routeAt(`${defaultBranchId}/fleet/devices/${fixtureDevice.id}/sms-commands`);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, ControlCenterWorkspace, SmsPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
};
export const Narrow: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  render: routed(),
};
export const ErrorState: Story = {
  name: 'Error',
  parameters: {
    holita: {
      scenario: { failures: { AdminControlCenterSmsDevices: 'network' } },
    } satisfies StoryFixtures,
  },
  render: routed(),
};
