import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureLiveDevice } from '../../../storybook/devices-fixtures';
import { onFrame } from '../../../storybook/story-config';
import { FleetLiveSummary } from './fleet-live-summary';
const meta: Meta<FleetLiveSummary> = {
  title: 'Design System/Fleet/Live summary',
  component: FleetLiveSummary,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<FleetLiveSummary>;
export const Devices: Story = {
  args: {
    devices: [fixtureLiveDevice, { ...fixtureLiveDevice, id: 'unassigned', vehicleId: null }],
  },
};
export const Vehicles: Story = {
  args: { devices: [], groups: [[fixtureLiveDevice], []], unassigned: 'vehicles' },
};
export const Unavailable: Story = { args: { devices: [undefined] } };
