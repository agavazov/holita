import type { Meta, StoryObj } from '@storybook/angular-vite';
import { onFrame, storyLanguage } from '../../../storybook/story-config';
import { FleetFaultCoverage } from './fleet-fault-coverage';

const meta: Meta<FleetFaultCoverage> = {
  title: 'Design System/Fleet/Fault coverage',
  component: FleetFaultCoverage,
  decorators: [onFrame],
  tags: ['!autodocs'],
  render: (args, { globals }) => ({ props: { ...args, language: storyLanguage(globals) } }),
  args: { hasFaultReports: false, lamps: [] },
};
export default meta;
type Story = StoryObj<FleetFaultCoverage>;
export const NoLampValues: Story = {
  args: {
    lamps: [1896, 1906, 1910].map((parameterId) => ({
      deviceId: 'device-1',
      parameterId,
      state: 'UNKNOWN',
      stateSince: null,
      recordedAt: null,
    })),
  },
};
export const ValuesReceived: Story = {
  args: {
    hasFaultReports: true,
    lamps: [1896, 1906, 1910].map((parameterId) => ({
      deviceId: 'device-1',
      parameterId,
      state: 'OFF',
      stateSince: '2026-11-06T07:30:00.000Z',
      recordedAt: '2026-11-06T08:00:00.000Z',
    })),
  },
};
