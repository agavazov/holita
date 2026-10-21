import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Record details',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(section: string): NonNullable<Story['render']> {
  return () => ({
    props: { url: `/en/karma-client/cars/41${section}` },
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Edata: Story = {
  render: routed('/edata'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = await canvas.findByRole(
      'button',
      { name: 'View message 3000000600' },
      { timeout: 10000 },
    );
    await userEvent.click(trigger);
    const dialog = await body.findByRole('dialog', { name: 'eData message details' });
    await expect(within(dialog).getByRole('region', { name: 'Record summary' })).toHaveTextContent(
      /Parameters in this message\s*2/,
    );
    await waitFor(() => expect(within(dialog).getByRole('cell', { name: '99999' })).toBeVisible());
    const parameters = dialog.querySelector('.karma-parameters .p-datatable-table-container');
    if (!(parameters instanceof HTMLElement)) {
      throw new Error('Missing parameter table.');
    }
    await expect(parameters.scrollWidth).toBeLessThanOrEqual(parameters.clientWidth);
    for (const cell of within(dialog).getAllByRole('cell')) {
      await expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth);
    }
    await expect(dialog.querySelector('details')).not.toHaveAttribute('open');
  },
};

export const EdataSourceFields: Story = {
  render: routed('/edata'),
  play: async (context) => {
    await Edata.play?.(context);
    const dialog = within(context.canvasElement.ownerDocument.body).getByRole('dialog', {
      name: 'eData message details',
    });
    await userEvent.click(within(dialog).getByText('Source fields', { exact: true }));
    await expect(dialog.querySelectorAll('details dd')).toHaveLength(11);
    await expect(dialog.querySelector('details')).toHaveTextContent(/pdt\s*—/);
    await expect(dialog.querySelector('details')).toHaveTextContent(/spd\s*0/);
  },
};

export const Events: Story = {
  render: routed('/events'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = await canvas.findByRole(
      'button',
      { name: 'View 3000000600' },
      { timeout: 10000 },
    );
    await userEvent.click(trigger);
    const dialog = await body.findByRole('dialog', { name: 'Event details' });
    await expect(within(dialog).getByRole('region', { name: 'Record summary' })).toHaveTextContent(
      /Event code \(eid\)\s*0/,
    );
    await expect(dialog.querySelector('.karma-source-text')).toHaveTextContent(
      '<b>Original source event text</b>',
    );
    await expect(dialog.querySelector('.karma-source-text b')).toBeNull();
    await expect(dialog.querySelector('details')).not.toHaveAttribute('open');
  },
};

export const EventSourceFieldsAndFocus: Story = {
  render: routed('/events'),
  play: async (context) => {
    await Events.play?.(context);
    const body = within(context.canvasElement.ownerDocument.body);
    const dialog = body.getByRole('dialog', { name: 'Event details' });
    await userEvent.click(within(dialog).getByText('Source fields', { exact: true }));
    await expect(dialog.querySelectorAll('details dd')).toHaveLength(12);
    await expect(dialog.querySelector('details')).toHaveTextContent(/longitude\s*—/);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Event details' })).toBeNull());
    await waitFor(() =>
      expect(
        within(context.canvasElement).getByRole('button', { name: 'View 3000000600' }),
      ).toHaveFocus(),
    );
  },
};

export const DrivingProfile: Story = {
  render: routed('/driving-profile?from=2026-01-01T00:00:00&to=2026-01-08T00:00:00'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(10), { timeout: 10000 });
    const period = canvas.getByRole('region', { name: 'Applied API period' });
    await expect(period).toHaveTextContent('2026-01-01T00:00:00');
    await expect(period).toHaveTextContent('2026-01-08T00:00:00');
    await expect(canvasElement.querySelector('details')).not.toHaveAttribute('open');
  },
};

export const TruckOverview: Story = {
  render: routed(''),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('region', { name: 'Truck summary' })).toBeVisible(),
      { timeout: 10000 },
    );
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Truck summary' })).toHaveTextContent(
        'International (12)',
      ),
    );
    await userEvent.click(canvas.getByText('Source fields', { exact: true }));
    await expect(canvasElement.querySelectorAll('details dd')).toHaveLength(10);
    await expect(canvasElement.querySelector('details')).toHaveTextContent(/Assigned drivers\s*0/);
    // Keep the fixed shell at the document origin in full-page visual captures.
    canvasElement.ownerDocument.defaultView?.scrollTo(0, 0);
    await waitFor(() => expect(canvasElement.ownerDocument.defaultView?.scrollY).toBe(0));
  },
};

export const MobileMessage: Story = {
  ...Edata,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
