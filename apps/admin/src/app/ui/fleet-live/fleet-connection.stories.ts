import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureLiveDevice } from '../../../storybook/devices-fixtures';
import { onFrame } from '../../../storybook/story-config';
import { FleetConnection } from './fleet-connection';

const meta: Meta<FleetConnection> = {
  title: 'Design System/Fleet/Connection',
  component: FleetConnection,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<FleetConnection>;
export const Online: Story = { args: { device: fixtureLiveDevice } };
export const WithoutDevice: Story = { args: { device: null } };
export const Unavailable: Story = { args: { device: undefined } };
export const Backup: Story = {
  args: { device: { ...fixtureLiveDevice, routing: 'KARMA_BACKUP' } },
};
export const Overdue: Story = {
  args: {
    device: {
      ...fixtureLiveDevice,
      ermState: fixtureLiveDevice.ermState
        ? {
            ...fixtureLiveDevice.ermState,
            online: false,
            health: { ...fixtureLiveDevice.ermState.health, overdue: true },
          }
        : null,
    },
  },
};
export const NeverConnected: Story = {
  args: { device: { ...fixtureLiveDevice, ermState: null, lastReportedAt: null } },
};
export const WithoutTruck: Story = { args: { device: { ...fixtureLiveDevice, vehicleId: null } } };
