import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureLiveDevice } from '../../../storybook/devices-fixtures';
import { onFrame } from '../../../storybook/story-config';
import { FleetNow } from './fleet-now';
const meta: Meta<FleetNow> = {
  title: 'Design System/Fleet/Now',
  component: FleetNow,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<FleetNow>;
export const Driving: Story = { args: { device: fixtureLiveDevice } };
export const IgnitionOff: Story = {
  args: {
    device: {
      ...fixtureLiveDevice,
      ermState: fixtureLiveDevice.ermState
        ? {
            ...fixtureLiveDevice.ermState,
            latestEvent: {
              ...fixtureLiveDevice.ermState.latestEvent,
              eventTime: '2026-10-20T08:00:00.000Z',
              speedKmh: 0,
              ignitionOn: false,
              engineOn: false,
              nameEn: 'Ignition off',
              nameBg: 'Изключен контакт',
            },
          }
        : null,
    },
  },
};
export const EngineRunning: Story = {
  args: {
    device: {
      ...fixtureLiveDevice,
      ermState: fixtureLiveDevice.ermState
        ? {
            ...fixtureLiveDevice.ermState,
            latestEvent: {
              ...fixtureLiveDevice.ermState.latestEvent,
              eventTime: '2026-10-20T08:00:00.000Z',
              speedKmh: 0,
              ignitionOn: true,
              engineOn: true,
              nameEn: 'Engine started',
              nameBg: 'Двигателят е стартиран',
            },
          }
        : null,
    },
  },
};
export const Empty: Story = { args: { device: null } };
