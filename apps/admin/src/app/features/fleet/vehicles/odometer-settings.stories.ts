import { signal } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { defaultFleetDisplay, FLEET_DISPLAY } from '../../../ui/format/fleet-format';
import { OdometerDrawer } from './odometer-drawer';

const meta: Meta<OdometerDrawer> = {
  title: 'Admin/Vehicles/Odometer settings',
  component: OdometerDrawer,
  tags: ['!autodocs'],
  args: {
    plate: 'CB 1000 AA',
    closeLink: null,
    inactive: false,
    saving: false,
    state: 'ready',
    previous: { odometerKm: 1000.1, recordedAt: '2026-10-18T06:00:00.000Z', source: 'MANUAL' },
    latestAllowedAt: '2026-10-18T07:00:00.000Z',
  },
};
export default meta;
type Story = StoryObj<OdometerDrawer>;

export const MilesAndNewYorkTime: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: FLEET_DISPLAY,
          useValue: signal({
            ...defaultFleetDisplay,
            distanceUnit: 'MI',
            timeZone: 'America/New_York',
          }),
        },
      ],
    }),
  ],
};

export const Inactive: Story = {
  args: { inactive: true },
};

export const NoLaterTime: Story = {
  args: { latestAllowedAt: '2026-10-18T06:00:00.000Z' },
};
