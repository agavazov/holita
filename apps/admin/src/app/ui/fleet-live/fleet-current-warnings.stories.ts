import type { Meta, StoryObj } from '@storybook/angular-vite';
import { onFrame, storyLanguage } from '../../../storybook/story-config';
import { FleetCurrentWarnings } from './fleet-current-warnings';

const meta: Meta<FleetCurrentWarnings> = {
  title: 'Design System/Fleet/Current warnings',
  component: FleetCurrentWarnings,
  decorators: [onFrame],
  tags: ['!autodocs'],
  render: (args, { globals }) => ({ props: { ...args, language: storyLanguage(globals) } }),
  args: { warnings: [] },
};
export default meta;
type Story = StoryObj<FleetCurrentWarnings>;
export const BrakeAndEngine: Story = {
  args: {
    warnings: [
      {
        deviceId: 'device-1',
        parameterId: 1896,
        state: 'RED',
        stateSince: '2026-11-06T07:00:00.000Z',
        recordedAt: '2026-11-06T08:00:00.000Z',
      },
      {
        deviceId: 'device-1',
        parameterId: 1906,
        state: 'YELLOW',
        stateSince: '2026-11-06T07:30:00.000Z',
        recordedAt: '2026-11-06T08:00:00.000Z',
      },
    ],
  },
};
export const NoWarnings: Story = {};
