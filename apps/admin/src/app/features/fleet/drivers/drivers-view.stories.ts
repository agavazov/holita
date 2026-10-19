import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleDrivers } from '../../../../storybook/samples/fleet-samples';

/**
 * The Drivers example inside the shell, with sample data. It shows the mixed drawer: a driver
 * opens read-only (contacts, documents with expiry flags, last 30 days) and Edit switches the
 * same drawer to the form; Cancel or a save returns to the record. Deactivate and Delete are row
 * and bulk actions alike.
 */
const meta: Meta = {
  title: 'Examples/Fleet/Drivers',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [driver] = sampleDrivers;
if (!driver) throw new Error('The sample drivers are empty.');
const appReady = { timeout: 10_000 };

async function tableReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
  return canvas;
}

async function drawerReady(canvasElement: HTMLElement, name: string) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
  return body;
}

export const Default: Story = {
  render: exampleAt('drivers'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(canvas.getAllByText('Expired').length).toBeGreaterThan(0);
  },
};

/**
 * Delete from the row menu asks about that driver by name; Cancel returns the focus to the row's
 * "⋮" button.
 */
export const DeleteFromRow: Story = {
  name: 'Delete from a row',
  render: exampleAt('drivers'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [trigger] = canvas.getAllByRole('button', { name: /^Actions for / });
    if (!trigger) throw new Error('No row actions');
    const name = (trigger.getAttribute('aria-label') ?? '').replace('Actions for ', '');
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const dialog = await body.findByRole('alertdialog', { name: 'Delete drivers?' });
    await expect(within(dialog).getByRole('listitem')).toHaveTextContent(name);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** History protects these drivers; a failed bulk deletion keeps them selected for review. */
export const DeleteSelected: Story = {
  name: 'Delete selected',
  render: exampleAt('drivers'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const protectedDrivers = sampleDrivers.filter((driver) => driver.trips30d > 0).slice(0, 3);
    for (const driver of protectedDrivers)
      await userEvent.click(canvas.getByRole('checkbox', { name: `Select ${driver.name}` }));
    const bar = await canvas.findByRole('region', { name: 'Actions for selected records' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Delete' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('alertdialog', { name: 'Delete drivers?' });
    await expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(canvas.getByText('Drivers with assignments or history were kept: 3.')).toBeVisible(),
    );
    for (const driver of protectedDrivers)
      await expect(canvas.getByRole('checkbox', { name: `Select ${driver.name}` })).toBeChecked();
  },
};

/** A row opens the driver read-only; Edit is in the drawer footer. */
export const View: Story = {
  render: exampleAt(`drivers?drawer=${driver.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, driver.name);
    await expect(body.getByRole('button', { name: 'Edit' })).toBeVisible();
  },
};

/** Edit switches the same drawer to the form; Cancel returns to the record. */
export const ViewThenEdit: Story = {
  name: 'View then edit',
  render: exampleAt(`drivers?drawer=${driver.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, driver.name);
    await userEvent.click(body.getByRole('button', { name: 'Edit' }));
    await waitFor(() =>
      expect(body.getByRole('textbox', { name: /First name/ })).toHaveValue(driver.firstName),
    );
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.getByRole('button', { name: 'Edit' })).toBeVisible());
  },
};

/** The row's Edit action opens the form directly. */
export const Edit: Story = {
  render: exampleAt(`drivers?drawer=${driver.id}&edit=1`),
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement, `Edit ${driver.name}`);
  },
};

export const Create: Story = {
  render: exampleAt('drivers?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'New driver');
    await userEvent.click(body.getByRole('button', { name: 'Add driver' }));
    await waitFor(() => expect(body.getByRole('textbox', { name: /First name/ })).toHaveFocus());
  },
};

export const SaveError: Story = {
  name: 'Save error',
  render: exampleAt(`drivers?scenario=save-error&drawer=${driver.id}&edit=1`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Edit ${driver.name}`);
    const name = body.getByRole('textbox', { name: /First name/ });
    const draft = `${driver.firstName} Draft`;
    await userEvent.clear(name);
    await userEvent.type(name, draft);
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(name).toBeDisabled());
    await waitFor(() => expect(body.getByRole('alert')).toHaveTextContent(/could not be saved/), {
      timeout: 3_000,
    });
    await expect(name).toBeEnabled();
    await expect(name).toHaveValue(draft);
    await waitFor(() =>
      expect(body.getByRole('dialog').contains(canvasElement.ownerDocument.activeElement)).toBe(
        true,
      ),
    );
  },
};

export const AssignedDriver: Story = {
  name: 'An assigned driver cannot be inactive',
  render: exampleAt(`drivers?drawer=${driver.id}&edit=1`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Edit ${driver.name}`);
    const status = body.getByRole('combobox', { name: 'Status' });
    await userEvent.click(status);
    await userEvent.click(await body.findByRole('option', { name: 'Inactive' }));
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(
      () => expect(body.getByText('Unassign this driver from its vehicles first.')).toBeVisible(),
      { timeout: 3_000 },
    );
    await expect(status).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(status).toHaveFocus());
  },
};

export const DetailsRoundtrip: Story = {
  name: 'Driver identity and documents roundtrip',
  render: exampleAt(`drivers?drawer=${driver.id}&edit=1`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Edit ${driver.name}`);
    const identity = body.getByRole('textbox', { name: 'Identification key' });
    const license = body.getByRole('textbox', { name: 'Driving license number' });
    const card = body.getByRole('textbox', { name: 'Tachograph card number' });
    await userEvent.clear(identity);
    await userEvent.type(identity, 'identity-roundtrip');
    await userEvent.clear(license);
    await userEvent.type(license, 'BG-ROUNDTRIP-123');
    await userEvent.clear(card);
    await userEvent.type(card, 'BG12345678901234');
    await userEvent.click(body.getByRole('combobox', { name: 'License categories' }));
    await userEvent.click(await body.findByRole('option', { name: 'DE' }));
    await userEvent.click(identity);
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body.getByRole('button', { name: 'Edit' })).toBeVisible(), {
      timeout: 3_000,
    });
    await expect(body.getByText('identity-roundtrip')).toBeVisible();
    await expect(body.getByText('BG-ROUNDTRIP-123')).toBeVisible();
    await expect(body.getByText('BG12345678901234')).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: 'Edit' }));
    await waitFor(() =>
      expect(body.getByRole('textbox', { name: 'Identification key' })).toHaveValue(
        'identity-roundtrip',
      ),
    );
    await expect(body.getByRole('textbox', { name: 'Driving license number' })).toHaveValue(
      'BG-ROUNDTRIP-123',
    );
    await expect(body.getByRole('textbox', { name: 'Tachograph card number' })).toHaveValue(
      'BG12345678901234',
    );
    await expect(body.getByRole('combobox', { name: 'License categories' })).toHaveTextContent(
      'DE',
    );
  },
};

export const SortMenu: Story = {
  name: 'Sort by fields outside the table',
  render: exampleAt('drivers'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Last name');
    await expect(canvas.getByRole('button', { name: /^Sort/ })).toHaveTextContent('Last name');
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Created at');
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Descending');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /^Sort/ })).toHaveTextContent('↓'),
    );
    const expected = [...sampleDrivers].sort((first, second) =>
      second.createdAt.localeCompare(first.createdAt),
    )[0];
    if (!expected) throw new Error('Missing driver sorting fixture.');
    const first = canvas.getAllByRole('row')[1];
    if (!first) throw new Error('Missing sorted driver row.');
    await expect(
      within(first).getByRole('button', { name: `Open ${expected.name}` }),
    ).toBeVisible();
  },
};

export const DirtyNavigation: Story = {
  name: 'Navigation keeps an unsaved driver draft',
  render: exampleAt(`drivers?drawer=${driver.id}&edit=1`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Edit ${driver.name}`);
    const name = body.getByRole('textbox', { name: /First name/ });
    await userEvent.type(name, ' Draft');
    await userEvent.click(within(canvasElement).getByRole('link', { name: 'Vehicles' }));
    await waitFor(() =>
      expect(body.getByRole('alertdialog', { name: 'Unsaved changes' })).toBeVisible(),
    );
    await userEvent.click(body.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(body.queryByRole('alertdialog')).toBeNull());
    await expect(name).toHaveValue(`${driver.firstName} Draft`);
    await expect(body.getByRole('dialog', { name: `Edit ${driver.name}` })).toBeVisible();
  },
};

export const Loading: Story = {
  render: exampleAt('drivers?scenario=loading'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('status', { name: 'Loading…' })).toBeVisible(),
      appReady,
    );
  },
};
export const Empty: Story = {
  render: exampleAt('drivers?scenario=empty'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('No drivers yet')).toBeVisible(), appReady);
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: exampleAt('drivers?scenario=error'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(canvas.getByText('The drivers could not be loaded. (demo-request-3)')).toBeVisible(),
      appReady,
    );
  },
};

export const Mobile: Story = {
  render: exampleAt('drivers'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: async ({ canvasElement }) => {
    await tableReady(canvasElement);
  },
};

export const Dark: Story = {
  render: exampleAt(`drivers?drawer=${driver.id}`),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement, driver.name);
  },
};
