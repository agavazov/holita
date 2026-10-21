import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem, enterNumber } from '../../../../storybook/interactions';
import {
  fixtureInactiveService,
  fixtureServiceReceipt,
  fixtureServiceTask,
} from '../../../../storybook/maintenance-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { MaintenanceRecordPage } from './maintenance-record-page';
const meta: Meta = {
  title: 'Admin/Service/Maintenance',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/maintenance`;
const appReady = { timeout: 10_000 };
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    // Compile the real lazy component graph before play on a cold Vite server.
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, MaintenanceRecordPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
async function tableReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () =>
      expect(canvas.getByRole('button', { name: /^Edit Oil change on CB 1001 AX$/ })).toBeVisible(),
    appReady,
  );
  return canvas;
}
async function drawerReady(canvasElement: HTMLElement, name: string) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
  return within(body.getByRole('dialog', { name }));
}
export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1, name: /^Maintenance/ })).toBeVisible();
    await expect(canvas.getByText('Warranty inspection', { exact: true })).toBeVisible();
  },
};
export const Edit: Story = {
  render: routed(`/${fixtureServiceTask.id}/edit?keep=storybook#maintenance`),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement, 'Edit Oil change');
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(drawer.getByRole('textbox', { name: 'Workshop' })).toHaveValue('Sofia workshop'),
      appReady,
    );
    await userEvent.clear(drawer.getByRole('textbox', { name: 'Workshop' }));
    await userEvent.type(drawer.getByRole('textbox', { name: 'Workshop' }), 'Saved workshop');
    await userEvent.click(drawer.getByRole('button', { name: /^Save$/ }));
    await waitFor(
      () => expect(body.queryByRole('dialog', { name: 'Edit Oil change' })).toBeNull(),
      appReady,
    );
    await waitFor(() => expect(body.getByText('Oil change was saved.')).toBeVisible(), appReady);
    await tableReady(canvasElement);
  },
};
export const CompleteAndPlan: Story = {
  name: 'Complete and plan next',
  render: routed(`/${fixtureServiceTask.id}/complete`),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement, 'Complete Oil change');
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () =>
        expect(drawer.getByRole('combobox', { name: /^Completion date/ })).toHaveValue(
          '2026-10-19',
        ),
      appReady,
    );
    await enterNumber(drawer.getByRole('spinbutton', { name: 'Completion odometer, km' }), 120300);
    await enterNumber(drawer.getByRole('spinbutton', { name: 'Actual cost, EUR' }), 123.45);
    await enterNumber(drawer.getByRole('spinbutton', { name: 'Next due odometer, km' }), 135000);
    await userEvent.type(
      drawer.getByRole('textbox', { name: 'Next task title' }),
      'Next oil change',
    );
    await userEvent.click(drawer.getByRole('button', { name: 'Complete and plan next' }));
    await waitFor(
      () => expect(body.queryByRole('dialog', { name: 'Complete Oil change' })).toBeNull(),
      appReady,
    );
    await waitFor(
      () =>
        expect(
          body.getByText('Oil change was completed and the next service was planned.'),
        ).toBeVisible(),
      appReady,
    );
  },
};
export const CompletedReceipt: Story = {
  name: 'Completed receipt',
  render: routed(`/${fixtureServiceReceipt.id}`),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement, 'Completed Warranty inspection');
    await expect(drawer.getByText('Oil filter', { exact: true })).toBeVisible();
    await expect(drawer.getByText('Covered by warranty.')).toBeVisible();
    await expect(drawer.queryByRole('button', { name: /^Complete/ })).toBeNull();
    const footerClose = drawer
      .getAllByRole('button', { name: /^Close$/ })
      .find((button) => button.closest('.route-drawer__footer'));
    if (!footerClose) {
      throw new Error('Missing receipt footer Close.');
    }
    await expect(footerClose).toBeVisible();
  },
};
export const InactiveHistory: Story = {
  name: 'Complete inactive vehicle history',
  render: routed(`/${fixtureInactiveService.id}/complete`),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement, 'Complete Historical service');
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(drawer.getByText(/This vehicle is inactive/)).toBeVisible(),
      appReady,
    );
    await expect(drawer.queryByRole('spinbutton', { name: 'Next due odometer, km' })).toBeNull();
    await userEvent.click(drawer.getByRole('button', { name: /^Complete service$/ }));
    await waitFor(
      () => expect(body.getByText('Historical service was completed.')).toBeVisible(),
      appReady,
    );
  },
};
export const CancelService: Story = {
  name: 'Cancel through a real batch',
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Actions for Oil change on CB 1001 AX' }),
    );
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Cancel service');
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('alertdialog', { name: 'Cancel service tasks?' });
    await expect(within(dialog).getByRole('listitem')).toHaveTextContent(
      'Oil change on CB 1001 AX',
    );
    await expect(
      canvas.getByRole('button', { name: 'Edit Oil change on CB 1001 AX' }),
    ).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel service' }));
    await waitFor(
      () => expect(body.getByText('Service tasks cancelled: 1.')).toBeVisible(),
      appReady,
    );
  },
};
export const BulkCancellation: Story = {
  name: 'Confirm or dismiss a selected service cancellation',
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole('checkbox', { name: 'Select Oil change on CB 1001 AX' }),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel service', exact: true }));
    const dialog = await body.findByRole('alertdialog', { name: 'Cancel service tasks?' });
    await expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
    await expect(within(dialog).getByRole('listitem')).toHaveTextContent(
      'Oil change on CB 1001 AX',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument(), appReady);
    await expect(
      canvas.getByRole('button', { name: 'Edit Oil change on CB 1001 AX' }),
    ).toBeVisible();
    await expect(body.queryByText('Service tasks cancelled: 1.')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel service', exact: true }));
    const reopened = await body.findByRole('alertdialog', { name: 'Cancel service tasks?' });
    await userEvent.click(within(reopened).getByRole('button', { name: 'Cancel service' }));
    await waitFor(
      () => expect(body.getByText('Service tasks cancelled: 1.')).toBeVisible(),
      appReady,
    );
    await waitFor(() => expect(reopened).not.toBeInTheDocument(), appReady);
    // Reads are immutable canned snapshots; persistence belongs to the guarded DB/browser checks.
    await expect(
      canvas.getByRole('checkbox', { name: 'Select Oil change on CB 1001 AX' }),
    ).not.toBeChecked();
    await expect(
      canvas.queryByRole('button', { name: 'Cancel service', exact: true }),
    ).not.toBeInTheDocument();
  },
};
export const CompletionConflict: Story = {
  name: 'Concurrent completion keeps the draft',
  render: routed(`/${fixtureServiceTask.id}/complete`),
  parameters: {
    holita: {
      scenario: { failures: { AdminCompleteServiceTask: 'conflict' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement, 'Complete Oil change');
    await userEvent.clear(drawer.getByRole('textbox', { name: 'Workshop' }));
    await userEvent.type(drawer.getByRole('textbox', { name: 'Workshop' }), 'Retained draft');
    await userEvent.click(drawer.getByRole('button', { name: /^Complete service$/ }));
    await waitFor(
      () => expect(drawer.getByRole('alert')).toHaveTextContent('The record changed meanwhile.'),
      appReady,
    );
    await expect(drawer.getByRole('textbox', { name: 'Workshop' })).toHaveValue('Retained draft');
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminServiceTasks: 'network' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('alert')).toHaveTextContent('fixture-AdminServiceTasks'),
      appReady,
    );
  },
};
