import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleDevices } from '../../../../storybook/samples/fleet-samples';

/**
 * The Devices example: tracker connection, signal, voltage and firmware, row and bulk actions; a
 * row opens the drawer with the device's diagnostics above its installation form (direct edit
 * with context).
 */
const meta: Meta = {
  title: 'Examples/Fleet/Devices',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [device] = sampleDevices;
if (!device) throw new Error('The sample devices are empty.');
const appReady = { timeout: 10_000 };

async function drawerReady(canvasElement: HTMLElement, name: string) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
  return body;
}

export const Default: Story = {
  render: exampleAt('devices'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
  },
};

/**
 * Restart from the bulk bar applies to online devices only: the dialog counts them, lists
 * them, and says how many selected devices it leaves unchanged; afterwards focus is on the list.
 */
export const RestartSelected: Story = {
  name: 'Restart selected',
  render: exampleAt('devices'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    const rows = canvas.getAllByRole('row');
    const online = rows.filter((row) => within(row).queryByText('Online') !== null).slice(0, 2);
    if (online.length < 2) throw new Error('Fewer than two online devices on the first page');
    const offline = rows.find((row) => within(row).queryByText('Offline') !== null);
    if (!offline) throw new Error('No offline device on the first page');
    for (const row of [...online, offline])
      await userEvent.click(within(row).getByRole('checkbox', { name: /^Select / }));
    const bar = await canvas.findByRole('region', { name: 'Actions for selected records' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Restart' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('alertdialog', { name: 'Restart devices?' });
    await expect(within(dialog).getAllByRole('listitem')).toHaveLength(2);
    // The dialog fades in: wait until its content is shown.
    await waitFor(() =>
      expect(
        within(dialog).getByText('Selected records it does not apply to are left unchanged: 1.'),
      ).toBeVisible(),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restart' }));
    await waitFor(() => expect(canvas.getByText('Restart sent to devices: 2.')).toBeVisible());
    await waitFor(() =>
      expect(canvas.getByRole('heading', { level: 2, name: /^Devices/ })).toHaveFocus(),
    );
  },
};

/** Diagnostics (read-only) above the installation form. */
export const Edit: Story = {
  render: exampleAt(`devices?drawer=${device.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Device ${device.imei}`);
    await expect(body.getByRole('heading', { name: 'Diagnostics' })).toBeVisible();
  },
};

export const Register: Story = {
  render: exampleAt('devices?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'Register device');
    await userEvent.type(body.getByRole('textbox', { name: /^IMEI/ }), '12345');
    await userEvent.click(body.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(body.getByRole('textbox', { name: /^IMEI/ })).toHaveFocus());
  },
};

export const DuplicateImei: Story = {
  name: 'Duplicate IMEI',
  render: exampleAt('devices?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'Register device');
    await userEvent.type(body.getByRole('textbox', { name: /^IMEI/ }), device.imei);
    await userEvent.click(body.getByRole('combobox', { name: 'Model' }));
    await userEvent.click(await body.findByRole('option', { name: device.model }));
    await userEvent.click(body.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(body.getByText('This IMEI is already registered.')).toBeVisible(), {
      timeout: 3_000,
    });
  },
};

export const Loading: Story = { render: exampleAt('devices?scenario=loading') };
export const Empty: Story = { render: exampleAt('devices?scenario=empty') };
export const ErrorState: Story = { name: 'Error', render: exampleAt('devices?scenario=error') };

export const Mobile: Story = {
  render: exampleAt('devices'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt(`devices?drawer=${device.id}`),
  globals: { theme: 'dark' },
};
