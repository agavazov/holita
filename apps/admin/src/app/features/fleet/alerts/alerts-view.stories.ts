import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleAlerts, vehicleById } from '../../../../storybook/samples/fleet-samples';

/**
 * The Alerts example: the list opens on the alerts still to handle (a removable status chip),
 * the row menu follows the workflow, the bulk bar acknowledges the selected alerts, and a row
 * opens a view drawer whose footer offers the next steps (acknowledge, resolve with an optional remark,
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
if (!open || !resolved) {
  throw new Error('The sample alerts lack a status.');
}
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

export const FilteredCounts: Story = {
  name: 'Summary follows severity while ignoring status',
  render: exampleAt('alerts'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Add filter' }));
    const editor = await body.findByRole('dialog', { name: 'Filter condition' });
    const column = within(editor).getByRole('combobox', { name: 'Column' });
    await userEvent.click(column);
    const columns = await body.findByRole('listbox');
    await userEvent.click(await body.findByRole('option', { name: /^Severity$/ }));
    await waitFor(() => expect(column).toHaveAttribute('aria-expanded', 'false'));
    await waitFor(() => expect(columns).not.toBeInTheDocument());
    const valueSelect = within(editor).getByRole('combobox', { name: 'Value' });
    await userEvent.click(valueSelect);
    const choices = await body.findByRole('listbox');
    await userEvent.click(await body.findByRole('option', { name: /^Critical$/ }));
    await waitFor(() => expect(valueSelect).toHaveTextContent('Critical'));
    await userEvent.click(valueSelect);
    await waitFor(() => expect(valueSelect).toHaveAttribute('aria-expanded', 'false'));
    await waitFor(() => expect(choices).not.toBeInTheDocument());
    await userEvent.click(within(editor).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(editor).not.toBeInTheDocument());
    const critical = sampleAlerts.filter((alert) => alert.severity === 'CRITICAL');
    for (const [label, value] of [
      ['Open critical', critical.filter((alert) => alert.status === 'OPEN').length],
      ['Open', critical.filter((alert) => alert.status === 'OPEN').length],
      ['Acknowledged', critical.filter((alert) => alert.status === 'ACKNOWLEDGED').length],
      ['Resolved', critical.filter((alert) => alert.status === 'RESOLVED').length],
    ] as const) {
      const tile = canvas
        .getByText(label, { selector: '.kpi-tile__label' })
        .closest<HTMLElement>('holita-kpi-tile');
      if (!tile) {
        throw new Error(`Missing ${label} summary tile.`);
      }
      await waitFor(() =>
        expect(within(tile).getByText(String(value), { selector: '.app-num' })).toBeVisible(),
      );
    }
    await expect(canvas.queryByText('Warning', { selector: '.p-tag-label' })).toBeNull();
    await expect(canvas.queryByText('Resolved', { selector: '.p-tag-label' })).toBeNull();
  },
};

/**
 * Resolve in the row menu opens the alert; Escape returns focus to the row's menu button.
 */
export const ResolveFromRow: Story = {
  name: 'Resolve from a row',
  render: exampleAt('alerts'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [trigger] = canvas.getAllByRole('button', { name: /^Actions for / });
    if (!trigger) {
      throw new Error('No row actions');
    }
    await userEvent.click(trigger);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Resolve');
    const drawer = await drawerReady(canvasElement);
    await expect(drawer.getByRole('button', { name: 'Resolve' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/**
 * The bulk bar offers Acknowledge; resolving opens one alert for review. It
 * leaves out the alerts already acknowledged; afterwards the focus is on the list.
 */
export const AcknowledgeSelected: Story = {
  name: 'Acknowledge selected',
  render: exampleAt('alerts'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [acknowledged] = rowsWithStatus(canvasElement, 'Acknowledged');
    if (!acknowledged) {
      throw new Error('No acknowledged alert');
    }
    const rows = [...rowsWithStatus(canvasElement, 'Open').slice(0, 2), acknowledged];
    for (const row of rows) {
      await userEvent.click(within(row).getByRole('checkbox'));
    }
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

/** An empty remark is a supported completion of the Resolve workflow. */
export const ResolveWithoutRemark: Story = {
  name: 'Resolve without a remark',
  render: exampleAt(`alerts?drawer=${open.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement);
    await userEvent.clear(body.getByRole('textbox', { name: /Remark/ }));
    await userEvent.click(body.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull(), { timeout: 3_000 });
    await waitFor(() => expect(body.getByText('Alerts resolved: 1.')).toBeVisible());
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
    const remark = body.getByRole('textbox', { name: /Remark/ });
    await userEvent.clear(remark);
    await userEvent.type(remark, 'Workshop contacted.');
    await userEvent.click(body.getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(remark).toBeDisabled());
    await waitFor(() => expect(body.getByRole('alert')).toHaveTextContent(/could not be updated/), {
      timeout: 3_000,
    });
    await expect(remark).toBeEnabled();
    await expect(remark).toHaveValue('Workshop contacted.');
    await waitFor(() =>
      expect(body.getByRole('dialog').contains(canvasElement.ownerDocument.activeElement)).toBe(
        true,
      ),
    );
  },
};

export const ClearRemark: Story = {
  name: 'Reopening can clear a remark',
  render: exampleAt(`alerts?drawer=${resolved.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement);
    const remark = body.getByRole('textbox', { name: /Remark/ });
    await userEvent.clear(remark);
    await userEvent.click(body.getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(body.getByRole('button', { name: 'Acknowledge' })).toBeVisible());
    await expect(remark).toHaveValue('');
  },
};

export const RemarkLimit: Story = {
  name: 'Remarks use the API limit',
  render: exampleAt(`alerts?drawer=${open.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement);
    const remark = body.getByRole('textbox', { name: /Remark/ });
    await userEvent.clear(remark);
    await userEvent.paste('x'.repeat(1001));
    await userEvent.click(body.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(remark).toHaveAttribute('aria-invalid', 'true'));
    await expect(remark).toHaveFocus();
    await expect(body.getByRole('button', { name: 'Resolve' })).toBeEnabled();
  },
};

export const DirtyVehicleNavigation: Story = {
  name: 'Opening a vehicle keeps an unsaved remark',
  render: exampleAt(`alerts?drawer=${open.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement);
    const drawer = within(body.getByRole('dialog'));
    const remark = drawer.getByRole('textbox', { name: /Remark/ });
    await userEvent.type(remark, 'Draft remark');
    const vehicle = vehicleById(open.vehicleId);
    if (!vehicle) {
      throw new Error('The sample alert lacks its vehicle.');
    }
    await userEvent.click(drawer.getByRole('link', { name: vehicle.plate }));
    await waitFor(() =>
      expect(body.getByRole('alertdialog', { name: 'Unsaved changes' })).toBeVisible(),
    );
    await userEvent.click(body.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(body.queryByRole('alertdialog')).toBeNull());
    await expect(remark).toHaveValue('Draft remark');
  },
};

export const Loading: Story = {
  render: exampleAt('alerts?scenario=loading'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('status', { name: 'Loading…' })).toBeVisible(),
      appReady,
    );
  },
};
export const Empty: Story = {
  render: exampleAt('alerts?scenario=empty'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('No matching records')).toBeVisible(), appReady);
    await userEvent.click(canvas.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(canvas.getByText('No alerts')).toBeVisible(), appReady);
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: exampleAt('alerts?scenario=error'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByText('The alerts could not be loaded.')).toBeVisible(),
      appReady,
    );
  },
};

export const Mobile: Story = {
  render: exampleAt('alerts'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: async ({ canvasElement }) => {
    await tableReady(canvasElement);
  },
};

export const Dark: Story = {
  render: exampleAt(`alerts?drawer=${open.id}`),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement);
  },
};
