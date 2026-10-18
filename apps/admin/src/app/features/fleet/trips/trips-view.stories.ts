import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleTrips } from '../../../../storybook/samples/fleet-samples';

/**
 * The Trips example: a read-only list (no selection or bulk actions) whose rows open a view
 * drawer with the trip summary and its timeline. Sample data, inside the shell.
 */
const meta: Meta = {
  title: 'Examples/Monitoring/Trips',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const withEvents = sampleTrips.find((trip) => trip.events.length > 1);
if (!withEvents) throw new Error('The sample trips have no events.');
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
    if (!first) throw new Error('No trip rows');
    await userEvent.click(first);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('button', { name: 'Open vehicle' })).toBeVisible());
  },
};

export const Loading: Story = { render: exampleAt('trips?scenario=loading') };
export const Empty: Story = { render: exampleAt('trips?scenario=empty') };
export const ErrorState: Story = { name: 'Error', render: exampleAt('trips?scenario=error') };

export const Mobile: Story = {
  render: exampleAt('trips'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt(`trips?drawer=${withEvents.id}`),
  globals: { theme: 'dark' },
};
