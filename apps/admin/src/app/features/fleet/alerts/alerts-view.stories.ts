import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleAlerts } from '../../../../storybook/samples/fleet-samples';

/**
 * The Alerts example: the list opens on the alerts still to handle (a removable status chip),
 * row and bulk actions follow the workflow, and a row opens a view drawer whose footer offers
 * the next steps (acknowledge, resolve with a remark, reopen). Sample data, inside the shell.
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

async function drawerReady(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(body.getByRole('dialog')).toBeVisible(), appReady);
  return body;
}

export const Default: Story = {
  render: exampleAt('alerts'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    await expect(canvas.queryByText('Resolved', { selector: '.p-tag-label' })).toBeNull();
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
