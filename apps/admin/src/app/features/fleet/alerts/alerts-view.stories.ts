import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleAlerts } from '../../../../storybook/samples/fleet-samples';

/**
 * The Alerts example: the list opens on the alerts still to handle (a removable status chip),
 * the row menu follows the workflow, the bulk bar acknowledges the selected alerts, and a row
 * opens a view drawer whose footer offers the next steps (acknowledge, resolve with a remark,
 * reopen). Sample data, inside the shell.
 */
const meta: Meta = {
  title: 'Examples/Monitoring/Alerts',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const open = sampleAlerts.find((alert) => alert.status === 'OPEN');
const resolved = sampleAlerts.find((alert) => alert.status === 'RESOLVED');
if (!open || !resolved) throw new Error('The sample alerts lack a status.');
const appReady = { timeout: 10_000 };

async function tableReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
  return canvas;
}

async function drawerReady(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(body.getByRole('dialog')).toBeVisible(), appReady);
  return body;
}

/** The table rows whose status tag reads `status`. */
function rowsWithStatus(canvasElement: HTMLElement, status: string): HTMLElement[] {
  return within(canvasElement)
    .getAllByRole('row')
    .filter((row) => within(row).queryByText(status, { selector: '.p-tag-label' }) !== null);
}

export const Default: Story = {
  render: exampleAt('alerts'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(canvas.queryByText('Resolved', { selector: '.p-tag-label' })).toBeNull();
  },
};

/**
 * Resolve in the row menu opens the alert with the focus on the remark that resolving needs;
 * Escape closes it and returns the focus to the row's "⋮" button.
 */
export const ResolveFromRow: Story = {
  name: 'Resolve from a row',
  render: exampleAt('alerts'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [trigger] = canvas.getAllByRole('button', { name: /^Actions for / });
    if (!trigger) throw new Error('No row actions');
    await userEvent.click(trigger);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Resolve');
    const drawer = await drawerReady(canvasElement);
    await waitFor(() => expect(drawer.getByRole('textbox', { name: /Remark/ })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/**
 * The bulk bar offers the quick step only: Acknowledge (resolving needs a remark per alert). It
 * leaves out the alerts already acknowledged; afterwards the focus is on the list.
 */
export const AcknowledgeSelected: Story = {
  name: 'Acknowledge selected',
  render: exampleAt('alerts'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [acknowledged] = rowsWithStatus(canvasElement, 'Acknowledged');
    if (!acknowledged) throw new Error('No acknowledged alert');
    const rows = [...rowsWithStatus(canvasElement, 'Open').slice(0, 2), acknowledged];
    for (const row of rows) await userEvent.click(within(row).getByRole('checkbox'));
    const bar = await canvas.findByRole('region', { name: 'Actions for selected records' });
    await expect(within(bar).queryByRole('button', { name: 'Resolve' })).toBeNull();
    await userEvent.click(within(bar).getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(canvas.getByText('Alerts acknowledged: 2.')).toBeVisible());
    await waitFor(() =>
      expect(canvas.getByRole('heading', { level: 2, name: /^Alerts/ })).toHaveFocus(),
    );
  },
};

/** An open alert: Acknowledge and Resolve in the footer. */
export const OpenAlert: Story = {
  name: 'Open alert',
  render: exampleAt(`alerts?drawer=${open.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement);
    await expect(body.getByRole('button', { name: 'Acknowledge' })).toBeVisible();
  },
};

/** Resolving needs a remark; the field says so and takes the focus. */
export const ResolveNeedsRemark: Story = {
  name: 'Resolve needs a remark',
  render: exampleAt(`alerts?drawer=${open.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement);
    await userEvent.click(body.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(body.getByRole('textbox', { name: /Remark/ })).toHaveFocus());
    await waitFor(() =>
      expect(body.getByText('Add a remark before resolving the alert.')).toBeVisible(),
    );
  },
};

export const ResolvedAlert: Story = {
  name: 'Resolved alert',
  render: exampleAt(`alerts?drawer=${resolved.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement);
    await expect(body.getByRole('button', { name: 'Reopen' })).toBeVisible();
  },
};

export const SaveError: Story = {
  name: 'Save error',
  render: exampleAt(`alerts?scenario=save-error&drawer=${open.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement);
    await userEvent.click(body.getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(body.getByRole('alert')).toHaveTextContent(/could not be updated/), {
      timeout: 3_000,
    });
  },
};

export const Loading: Story = { render: exampleAt('alerts?scenario=loading') };
export const Empty: Story = { render: exampleAt('alerts?scenario=empty') };
export const ErrorState: Story = { name: 'Error', render: exampleAt('alerts?scenario=error') };

export const Mobile: Story = {
  render: exampleAt('alerts'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt(`alerts?drawer=${open.id}`),
  globals: { theme: 'dark' },
};
