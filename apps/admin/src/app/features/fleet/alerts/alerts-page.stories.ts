import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { fixtureAlert } from '../../../../storybook/alerts-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { AlertDetailPage } from './alert-detail-page';
const meta: Meta = {
  title: 'Admin/Monitoring/Alerts',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/alerts`;
const appReady = { timeout: 10_000 };
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    // Compile real lazy route components before a cold-server play starts.
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, AlertDetailPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
async function listReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () => expect(canvas.getByRole('button', { name: 'Open Low fuel on CB 1001 AX' })).toBeVisible(),
    appReady,
  );
  return canvas;
}
export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await listReady(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1, name: /^Alerts/ })).toBeVisible();
    await expect(canvas.getAllByRole('link', { name: 'CB 1001 AX' })[0]).toHaveAttribute(
      'href',
      `/en/${defaultBranchId}/fleet/vehicles/${fixtureAlert.vehicleId}/overview`,
    );
    await expect(canvas.getAllByRole('link', { name: 'Elena Petrova' })[0]).toHaveAttribute(
      'href',
      `/en/${defaultBranchId}/fleet/drivers/${String(fixtureAlert.driverId)}`,
    );
  },
};
export const Resolve: Story = {
  render: routed(`/${fixtureAlert.id}?keep=storybook#alerts`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: 'Low fuel' })).toBeVisible(),
      appReady,
    );
    const drawer = within(body.getByRole('dialog', { name: 'Low fuel' }));
    await expect(drawer.getByRole('link', { name: 'CB 1001 AX' })).toHaveAttribute(
      'href',
      `/en/${defaultBranchId}/fleet/vehicles/${fixtureAlert.vehicleId}/overview`,
    );
    await expect(drawer.getByRole('link', { name: 'Elena Petrova' })).toHaveAttribute(
      'href',
      `/en/${defaultBranchId}/fleet/drivers/${String(fixtureAlert.driverId)}`,
    );
    await waitFor(
      () =>
        expect(drawer.getByRole('textbox', { name: /Remark/ })).toHaveValue(
          'Investigate at the next stop.',
        ),
      appReady,
    );
    await userEvent.clear(drawer.getByRole('textbox', { name: /Remark/ }));
    await userEvent.type(
      drawer.getByRole('textbox', { name: /Remark/ }),
      'Checked at the next stop.',
    );
    await userEvent.click(drawer.getByRole('button', { name: /^Resolve$/ }));
    await waitFor(
      () => expect(body.queryByRole('dialog', { name: 'Low fuel' })).toBeNull(),
      appReady,
    );
    await waitFor(() => expect(body.getByText('Alerts resolved: 1.')).toBeVisible(), appReady);
    await listReady(canvasElement);
  },
};
export const PartialAcknowledge: Story = {
  name: 'Partial acknowledgment',
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await listReady(canvasElement);
    const selectPage = await waitFor(async () => {
      const checkbox = canvas.getByRole('checkbox', { name: 'Select all on this page' });
      await expect(checkbox).toBeInTheDocument();
      await expect(checkbox).toBeEnabled();
      return checkbox;
    }, appReady);
    await userEvent.click(selectPage);
    await waitFor(() => expect(selectPage).toBeChecked(), appReady);
    const acknowledge = await waitFor(async () => {
      const button = canvas.getByRole('button', { name: /^Acknowledge/ });
      await expect(button).toBeEnabled();
      return button;
    }, appReady);
    await userEvent.click(acknowledge);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByText('Alerts acknowledged: 1. Failed: 1.')).toBeVisible(),
      appReady,
    );
    await expect(body.getByText(/The alert changed meanwhile/)).toBeVisible();
  },
};
export const Conflict: Story = {
  render: routed(`/${fixtureAlert.id}`),
  parameters: {
    holita: { scenario: { failures: { AdminResolveAlert: 'conflict' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: 'Low fuel' })).toBeVisible(),
      appReady,
    );
    const drawer = within(body.getByRole('dialog', { name: 'Low fuel' }));
    const remark = await waitFor(async () => {
      const input = drawer.getByRole('textbox', { name: /Remark/ });
      await expect(input).toHaveValue('Investigate at the next stop.');
      return input;
    }, appReady);
    await userEvent.clear(remark);
    await userEvent.type(remark, 'Retain my draft.');
    await userEvent.click(drawer.getByRole('button', { name: /^Resolve$/ }));
    await waitFor(
      () => expect(drawer.getByText(/Its latest status is shown/)).toBeVisible(),
      appReady,
    );
    await expect(remark).toHaveValue('Retain my draft.');
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminAlerts: 'network' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('alert')).toHaveTextContent('fixture-AdminAlerts'),
      appReady,
    );
  },
};
