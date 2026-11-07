import type { Meta, StoryObj } from '@storybook/angular-vite';
import {
  karmaBackupDeviceId,
  uncertainReturnDeviceId,
  unobservedDeviceId,
} from '../../../storybook/control-center-fixtures';
import { fixtureDevice } from '../../../storybook/devices-fixtures';
import {
  settingsBatchDeviceId,
  settingsWritableDeviceId,
} from '../../../storybook/device-settings-fixtures';
import { defaultBranchId } from '../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { ControlCenterWorkspace } from './control-center-workspace';
import { DevicePage, type DeviceTab } from './device-page';

const meta: Meta = {
  title: 'Admin/Devices/Device',
  tags: ['!autodocs'],
  parameters: {
    holita: { signedIn: true, now: '2026-10-20T08:00:05.000Z' } satisfies StoryFixtures,
  },
};
export default meta;
type Story = StoryObj;
function routed(tab: DeviceTab, recordId = fixtureDevice.id): NonNullable<Story['render']> {
  const path = tab === 'events' || tab === 'frames' ? `technical-details/${tab}` : tab;
  const render = routeAt(`${defaultBranchId}/fleet/devices/${recordId}/${path}`);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, ControlCenterWorkspace, DevicePage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Overview: Story = { render: routed('overview') };
export const Problems: Story = { render: routed('problems') };
export const Commands: Story = { render: routed('commands') };
export const SmsCommands: Story = { name: 'SMS commands', render: routed('sms-commands') };
export const Parameters: Story = { render: routed('parameters', settingsWritableDeviceId) };
export const ParametersBatch: Story = {
  name: 'Parameters — Batch progress',
  render: routed('parameters', settingsBatchDeviceId),
};
export const Events: Story = { name: 'Technical details — Events', render: routed('events') };
export const Frames: Story = { name: 'Technical details — Frames', render: routed('frames') };
export const KarmaBackup: Story = {
  name: 'Overview — Karma backup and warning lamps',
  render: routed('overview', karmaBackupDeviceId),
};
export const ReturnUncertain: Story = {
  name: 'Overview — Uncertain return',
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  render: routed('overview', uncertainReturnDeviceId),
};
export const NoObservation: Story = {
  name: 'Overview — No observations',
  render: routed('overview', unobservedDeviceId),
};
