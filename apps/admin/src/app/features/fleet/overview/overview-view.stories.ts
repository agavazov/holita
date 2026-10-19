import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleTrips } from '../../../../storybook/samples/fleet-samples';

/**
 * The Fleet overview (dashboard): KPI tiles that open the lists behind them, the items that need
 * attention (each opens its record), distance per day, activity by group and the latest trips.
 */
const meta: Meta = {
  title: 'Examples/Monitoring/Overview',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const appReady = { timeout: 10_000 };

export const Default: Story = {
  render: exampleAt('overview'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('heading', { name: 'Needs attention' })).toBeVisible(),
      appReady,
    );
    await expect(canvas.getByRole('figure', { name: /Fleet distance per day/ })).toBeVisible();
  },
};

/** An attention item opens its record: here an alert in the Alerts drawer. */
export const OpenAttentionItem: Story = {
  name: 'Open an attention item',
  render: exampleAt('overview'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('heading', { name: 'Needs attention' })).toBeVisible(),
      appReady,
    );
    const [first] = canvas.getAllByRole('link', { name: / · / });
    if (!first) {
      throw new Error('No attention items');
    }
    await userEvent.click(first);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible(), appReady);
  },
};

export const NothingToHandle: Story = {
  name: 'Nothing to handle',
  render: exampleAt('overview?scenario=calm'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(within(canvasElement).getByText('Nothing needs attention right now.')).toBeVisible(),
      appReady,
    );
  },
};

export const OpenLatestTrip: Story = {
  name: 'Open a latest trip',
  render: exampleAt('overview'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('heading', { name: 'Latest trips' })).toBeVisible(),
      appReady,
    );
    const latest = [...sampleTrips].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (!latest) {
      throw new Error('Missing sample trip.');
    }
    const link = canvasElement.querySelector<HTMLAnchorElement>(`a[href$="drawer=${latest.id}"]`);
    if (!link) {
      throw new Error('Missing trip link.');
    }
    await userEvent.click(link);
    await waitFor(
      () => expect(within(canvasElement.ownerDocument.body).getByRole('dialog')).toBeVisible(),
      appReady,
    );
  },
};

export const Loading: Story = {
  render: exampleAt('overview?scenario=loading'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(within(canvasElement).getByRole('group', { name: 'Fleet today' })).toHaveAttribute(
          'aria-busy',
          'true',
        ),
      appReady,
    );
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: exampleAt('overview?scenario=error'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(within(canvasElement).getByText('The overview could not be loaded')).toBeVisible(),
      appReady,
    );
  },
};

export const Mobile: Story = {
  render: exampleAt('overview'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByRole('heading', { name: 'Needs attention' }),
        ).toBeVisible(),
      appReady,
    );
  },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt('overview'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByRole('heading', { name: 'Needs attention' }),
        ).toBeVisible(),
      appReady,
    );
  },
  globals: { theme: 'dark' },
};
