import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleDevices, sampleVehicles } from '../../../../storybook/samples/fleet-samples';

/**
 * The Devices example: tracker connection, signal, voltage and firmware, row and bulk actions; a
 * row opens read-only Diagnostics, followed by an explicit Edit action.
 */
const meta: Meta = {
  title: 'Examples/Fleet/Devices',
  tags: ['!autodocs', 'prototype'],
};

export default meta;
type Story = StoryObj;

const [device] = sampleDevices;
if (!device) {
  throw new Error('The sample devices are empty.');
}
const appReady = { timeout: 10_000 };
const pageReady: NonNullable<Story['play']> = async ({ canvasElement }) => {
  await waitFor(
    () =>
      expect(
        within(canvasElement).getByRole('heading', { level: 1, name: 'Devices' }),
      ).toBeVisible(),
    appReady,
  );
};

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
    await expect(canvas.getByText('Demo features')).toBeVisible();
    await expect(
      canvas.getByText('Connection, diagnostics and restart actions use sample data.'),
    ).toBeVisible();
  },
};

export const ViewThenEdit: Story = {
  name: 'Read device before editing',
  render: exampleAt('devices'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(canvas.getByRole('button', { name: `Open device ${device.imei}` })).toBeVisible(),
      appReady,
    );
    await userEvent.click(canvas.getByRole('button', { name: `Open device ${device.imei}` }));
    const body = await drawerReady(canvasElement, 'Diagnostics');
    await expect(
      within(body.getByRole('dialog', { name: 'Diagnostics' })).queryByRole('textbox'),
    ).toBeNull();
    await userEvent.click(
      within(body.getByRole('dialog', { name: 'Diagnostics' })).getByRole('button', {
        name: 'Edit',
      }),
    );
    await drawerReady(canvasElement, `Device ${device.imei}`);
    await userEvent.click(
      within(body.getByRole('dialog', { name: `Device ${device.imei}` })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await drawerReady(canvasElement, 'Diagnostics');
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
    if (online.length < 2) {
      throw new Error('Fewer than two online devices on the first page');
    }
    const offline = rows.find((row) => within(row).queryByText('Offline') !== null);
    if (!offline) {
      throw new Error('No offline device on the first page');
    }
    for (const row of [...online, offline]) {
      await userEvent.click(within(row).getByRole('checkbox', { name: /^Select / }));
    }
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
    await expect(
      within(body.getByRole('dialog', { name: `Device ${device.imei}` })).getByText(
        'Demo features',
      ),
    ).toBeVisible();
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
    const imei = body.getByRole('textbox', { name: /^IMEI/ });
    await userEvent.click(body.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(imei).toBeDisabled());
    await waitFor(() => expect(body.getByText('This IMEI is already registered.')).toBeVisible(), {
      timeout: 3_000,
    });
    await expect(imei).toBeEnabled();
    await expect(imei).toHaveValue(device.imei);
    await expect(imei).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(imei).toHaveFocus());
  },
};

export const RequiredModel: Story = {
  name: 'Required model receives focus',
  render: exampleAt('devices?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'Register device');
    await userEvent.type(body.getByRole('textbox', { name: /^IMEI/ }), '000000000000123');
    await userEvent.click(body.getByRole('button', { name: 'Register' }));
    const model = body.getByRole('combobox', { name: 'Model' });
    await waitFor(() => expect(model).toHaveAttribute('aria-invalid', 'true'));
    await waitFor(() => expect(model).toHaveFocus());
  },
};

export const RegisterInstalled: Story = {
  name: 'Register an installed device',
  render: exampleAt('devices?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'Register device');
    const imei = '000000000000123';
    const vehicle = sampleVehicles.find((item) => item.id === 'v01');
    if (!vehicle) {
      throw new Error('Missing registration vehicle.');
    }
    await userEvent.type(body.getByRole('textbox', { name: /^IMEI/ }), imei);
    await userEvent.click(body.getByRole('combobox', { name: 'Model' }));
    await userEvent.click(await body.findByRole('option', { name: device.model }));
    await userEvent.type(
      body.getByRole('textbox', { name: 'SIM ICCID' }),
      '1234567890123456789012',
    );
    await userEvent.click(body.getByRole('combobox', { name: 'Installed in' }));
    await userEvent.click(await body.findByRole('option', { name: vehicle.plate }));
    await userEvent.click(body.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull(), { timeout: 3_000 });
    const row = within(canvasElement).getByRole('row', { name: new RegExp(imei) });
    await expect(within(row).getByText('Offline')).toBeVisible();
    await expect(within(row).getByText(vehicle.plate)).toBeVisible();
    await expect(within(row).getByText('Never')).toBeVisible();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Created at');
    await waitFor(() => expect(body.queryByRole('menu')).toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Descending');
    await waitFor(() => expect(body.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(canvas.getAllByRole('row')[1]).toHaveTextContent(imei));
  },
};

export const InstalledAtSort: Story = {
  name: 'Sort by installation time',
  render: exampleAt('devices'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    const selected = canvas.getAllByRole('checkbox', { name: /^Select (?!all)/ })[0];
    if (!selected) {
      throw new Error('No device row to select.');
    }
    await userEvent.click(selected);
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Installed at');
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).queryByRole('menu')).toBeNull(),
    );
    await expect(canvas.getByRole('button', { name: /^Sort/ })).toHaveTextContent('Installed at');
    await expect(canvas.queryByRole('region', { name: 'Actions for selected records' })).toBeNull();
  },
};

export const CurrentSortPreservesSelection: Story = {
  name: 'Current sort preserves the page and selection',
  render: exampleAt('devices'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    const firstPageRow = canvas.getAllByRole('row')[1]?.textContent;
    await userEvent.click(canvas.getByRole('button', { name: /^Next page$/i }));
    await waitFor(() => expect(canvas.getAllByRole('row')[1]?.textContent).not.toBe(firstPageRow));
    const selected = canvas.getAllByRole('checkbox', { name: /^Select (?!all)/ })[0];
    const name = selected?.getAttribute('aria-label');
    if (!selected || !name) {
      throw new Error('No named device checkbox on page two.');
    }
    const imei = name.replace(/^Select /, '');
    await userEvent.click(selected);
    for (const label of ['IMEI', 'Ascending']) {
      await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
      const current = await body.findByRole('menuitem', { name: new RegExp(`^${label}\\b`) });
      await userEvent.click(within(current).getByText(label, { exact: true }));
      await waitFor(() => expect(body.queryByRole('menu')).toBeNull());
      await expect(canvas.getByRole('checkbox', { name })).toBeChecked();
      await expect(canvas.getAllByRole('row')[1]).toHaveTextContent(imei);
    }
  },
};

export const SaveError: Story = {
  name: 'Failed save keeps the draft',
  render: exampleAt(`devices?drawer=${device.id}&scenario=save-error`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Device ${device.imei}`);
    const sim = body.getByRole('textbox', { name: 'SIM ICCID' });
    await userEvent.clear(sim);
    await userEvent.type(sim, '123456789012345678');
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sim).toBeDisabled());
    await waitFor(() => expect(body.getByText(/The device could not be saved/)).toBeVisible(), {
      timeout: 3_000,
    });
    await expect(sim).toBeEnabled();
    await expect(sim).toHaveValue('123456789012345678');
    const focused = canvasElement.ownerDocument.activeElement;
    await expect(body.getByRole('dialog', { name: `Device ${device.imei}` })).toContainElement(
      focused instanceof HTMLElement ? focused : null,
    );
  },
};

export const Loading: Story = { render: exampleAt('devices?scenario=loading'), play: pageReady };
export const Empty: Story = { render: exampleAt('devices?scenario=empty'), play: pageReady };
export const ErrorState: Story = {
  name: 'Error',
  render: exampleAt('devices?scenario=error'),
  play: pageReady,
};

export const Mobile: Story = {
  render: exampleAt('devices'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: pageReady,
};

export const Dark: Story = {
  render: exampleAt(`devices?drawer=${device.id}`),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement, `Device ${device.imei}`);
  },
};
