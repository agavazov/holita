import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';

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
    if (!first) throw new Error('No attention items');
    await userEvent.click(first);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible(), appReady);
  },
};

export const NothingToHandle: Story = {
  name: 'Nothing to handle',
  render: exampleAt('overview?scenario=calm'),
};

export const Loading: Story = { render: exampleAt('overview?scenario=loading') };
export const ErrorState: Story = { name: 'Error', render: exampleAt('overview?scenario=error') };

export const Mobile: Story = {
  render: exampleAt('overview'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt('overview'),
  globals: { theme: 'dark' },
};
