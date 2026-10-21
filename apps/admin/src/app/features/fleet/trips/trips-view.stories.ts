import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleTrips } from '../../../../storybook/samples/fleet-samples';

/**
 * The Trips example: a read-only list (no selection or bulk actions) whose rows open a view
 * drawer with the trip summary and its timeline, or the vehicle profile from the row menu.
 * Sample data, inside the shell.
 */
const meta: Meta = {
  title: 'Examples/Monitoring/Trips',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const withEvents = sampleTrips.find((trip) => trip.events.length > 1);
if (!withEvents) {
  throw new Error('The sample trips have no events.');
}
const appReady = { timeout: 10_000 };

export const Default: Story = {
  render: exampleAt('trips'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    await expect(canvas.queryAllByRole('checkbox')).toHaveLength(0);
  },
};

/** The newest trips come first; a header click sorts (here: oldest first). */
export const Sorting: Story = {
  render: exampleAt('trips'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    const started = canvas.getByRole('columnheader', { name: /Started/ });
    await expect(started).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(started);
    await waitFor(() => expect(started).toHaveAttribute('aria-sort', 'ascending'));
  },
};

/** A row opens the trip read-only: summary facts and the timeline. */
export const TripDrawer: Story = {
  name: 'Trip drawer',
  render: exampleAt(`trips?drawer=${withEvents.id}`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible(), appReady);
    await expect(body.getByText(/^Departed from/)).toBeVisible();
    await expect(body.getByText(/^Arrived at/)).toBeVisible();
  },
};

export const OpenFromList: Story = {
  name: 'Open from the list',
  render: exampleAt('trips'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    const [first] = canvas.getAllByRole('button', { name: /^Open trip / });
    if (!first) {
      throw new Error('No trip rows');
    }
    await userEvent.click(first);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('link', { name: 'Open vehicle' })).toBeVisible());
  },
};

/** The row menu opens the trip or, as here, the profile of its vehicle. */
export const OpenVehicleFromRow: Story = {
  name: 'Open the vehicle from a row',
  render: exampleAt('trips'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    const [trigger] = canvas.getAllByRole('button', { name: /^Actions for / });
    if (!trigger) {
      throw new Error('No row actions');
    }
    // The menu names the trip "<plate>, <started>".
    const name = (trigger.getAttribute('aria-label') ?? '').replace('Actions for ', '');
    const plate = name.split(', ')[0] ?? '';
    await userEvent.click(trigger);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Open vehicle profile');
    await waitFor(
      () => expect(canvas.getByRole('heading', { level: 1, name: plate })).toBeVisible(),
      appReady,
    );
  },
};

export const Loading: Story = {
  render: exampleAt('trips?scenario=loading'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('status', { name: 'Loading…' })).toBeVisible(),
      appReady,
    );
  },
};
export const Empty: Story = {
  render: exampleAt('trips?scenario=empty'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('No trips yet')).toBeVisible(), appReady);
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: exampleAt('trips?scenario=error'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByText('The trips could not be loaded.')).toBeVisible(),
      appReady,
    );
  },
};

export const InProgress: Story = {
  name: 'Trip in progress',
  render: exampleAt('trips?scenario=in-progress&drawer=t001'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible(), appReady);
    const drawer = within(body.getByRole('dialog'));
    await expect(drawer.getByText('In progress')).toBeVisible();
    await expect(drawer.queryByText(/^Arrived/)).toBeNull();
    await expect(drawer.getByText('Departed', { exact: true })).toBeVisible();
  },
};

export const MissingEnd: Story = {
  name: 'Old trip without an end',
  render: exampleAt('trips?scenario=missing-end&drawer=t001'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible(), appReady);
    const drawer = within(body.getByRole('dialog'));
    await expect(drawer.getByText('End not received')).toBeVisible();
    await expect(drawer.queryByText('In progress')).toBeNull();
    await expect(drawer.queryByText(/^Arrived/)).toBeNull();
  },
};

export const Mobile: Story = {
  render: exampleAt('trips'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
  },
};

export const Dark: Story = {
  render: exampleAt(`trips?drawer=${withEvents.id}`),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible(), appReady);
  },
};
