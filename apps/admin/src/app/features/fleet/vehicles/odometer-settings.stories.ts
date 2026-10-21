import { signal } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import { defaultFleetDisplay, FLEET_DISPLAY } from '../../../ui/format/fleet-format';
import { OdometerDrawer } from './odometer-drawer';

const meta: Meta<OdometerDrawer> = {
  title: 'Admin/Fleet/Odometer settings',
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
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('spinbutton', { name: /Odometer, mi/ })).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(body.getByText('America/New_York time')).toBeVisible();
    await expect(body.getByLabelText(/Reading time/)).toHaveValue('2026-10-18T03:00');
    await expect(body.getByRole('button', { name: 'Record reading' })).toBeEnabled();
  },
};

export const Inactive: Story = {
  args: { inactive: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () =>
        expect(
          body.getByText('Manual readings are unavailable for inactive vehicles.'),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(body.getByRole('spinbutton', { name: /Odometer/ })).toBeDisabled();
    await expect(body.getByRole('button', { name: 'Record reading' })).toBeDisabled();
  },
};

export const NoLaterTime: Story = {
  args: { latestAllowedAt: '2026-10-18T06:00:00.000Z' },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () =>
        expect(
          body.getByText(
            'No later reading time is available yet. Wait for newer vehicle data, then reopen this form.',
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(body.getByLabelText(/Reading time/)).toBeDisabled();
    await expect(body.getByRole('button', { name: 'Record reading' })).toBeDisabled();
  },
};
