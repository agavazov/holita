import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleVehicles } from '../../../../storybook/samples/fleet-samples';

/**
 * The Vehicles example inside the shell, with sample data: quick search, the filter builder,
 * sorting, paging, row and bulk actions. A vehicle plate opens its profile; Edit opens
 * the form in the right-hand drawer. The sidebar leads to the other example pages.
 */
const meta: Meta = {
  title: 'Examples/Fleet/Vehicles',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [edited] = sampleVehicles;
if (!edited) {
  throw new Error('The sample fleet is empty.');
}
/** The example app routes and renders its first page before the list appears. */
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
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1, name: /Vehicles/ })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Vehicles' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};

/** The fastest filter: the quick search narrows the list as you type. */
export const QuickSearch: Story = {
  name: 'Quick search',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox'), edited.plate);
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(2));
  },
};

export const NoResults: Story = {
  name: 'No results',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox'), 'no such vehicle');
    await waitFor(() => expect(canvas.getByText('No matching records')).toBeVisible());
    await expect(canvas.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  },
};

/** Row actions live in the "⋮" menu; Delete is last and asks for confirmation. */
export const RowActionsMenu: Story = {
  name: 'Row actions',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [first] = canvas.getAllByRole('button', { name: /^Actions for / });
    if (!first) {
      throw new Error('No row actions');
    }
    await userEvent.click(first);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('menuitem', { name: 'Delete' })).toBeVisible());
  },
};

/**
 * Delete from the row menu asks about that vehicle by name; Cancel returns the focus to the
 * row's "⋮" button.
 */
export const DeleteFromRow: Story = {
  name: 'Delete from a row',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [trigger] = canvas.getAllByRole('button', { name: /^Actions for / });
    if (!trigger) {
      throw new Error('No row actions');
    }
    const plate = (trigger.getAttribute('aria-label') ?? '').replace('Actions for ', '');
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const dialog = await body.findByRole('alertdialog', { name: 'Delete vehicles?' });
    await expect(within(dialog).getByRole('listitem')).toHaveTextContent(plate);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** The same Delete from the bulk bar lists the selected vehicles; afterwards focus is on the list. */
export const DeleteSelected: Story = {
  name: 'Delete selected',
  render: exampleAt('vehicles?scenario=deletable'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const boxes = canvas.getAllByRole('checkbox', { name: /^Select (?!all)/ });
    for (const box of boxes.slice(0, 3)) {
      await userEvent.click(box);
    }
    const tableTop = canvas.getByRole('table').getBoundingClientRect().top;
    const bar = await canvas.findByRole('region', { name: 'Actions for selected records' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Delete' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('alertdialog', { name: 'Delete vehicles?' });
    await expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(canvas.getByText('Vehicles deleted: 3.')).toBeVisible());
    await expect(canvasElement.querySelectorAll('.p-toast-message')).toHaveLength(1);
    await expect(canvas.getByRole('table').getBoundingClientRect().top).toBe(tableTop);
    await waitFor(() =>
      expect(canvas.getByRole('heading', { level: 2, name: /^Vehicles/ })).toHaveFocus(),
    );
  },
};

/** Selected rows show the bulk actions docked at the bottom, without moving the table. */
export const BulkSelection: Story = {
  name: 'Bulk selection',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const boxes = canvas.getAllByRole('checkbox', { name: /^Select (?!all)/ });
    for (const box of boxes.slice(0, 3)) {
      await userEvent.click(box);
    }
    await waitFor(() => expect(canvas.getByText('3 selected')).toBeVisible());
  },
};

/** The Edit action opens the form directly in the drawer. */
export const Edit: Story = {
  render: exampleAt(`vehicles?drawer=${edited.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Edit ${edited.plate}`);
    await expect(body.getByRole('textbox', { name: /License plate/ })).toHaveValue(edited.plate);
  },
};

export const Create: Story = {
  render: exampleAt('vehicles?drawer=new'),
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement, 'New vehicle');
  },
};

/** Saving an incomplete form shows every error and focuses the first invalid field. */
export const ValidationErrors: Story = {
  name: 'Validation errors',
  render: exampleAt('vehicles?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'New vehicle');
    await userEvent.click(body.getByRole('button', { name: 'Create vehicle' }));
    await waitFor(() => expect(body.getByRole('textbox', { name: /License plate/ })).toHaveFocus());
  },
};

/** The server rejects the save: the drawer stays open with the message and the draft. */
export const SaveError: Story = {
  name: 'Save error',
  render: exampleAt(`vehicles?scenario=save-error&drawer=${edited.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Edit ${edited.plate}`);
    const plate = body.getByRole('textbox', { name: /License plate/ });
    await userEvent.clear(plate);
    await userEvent.type(plate, 'CB 7777 XX');
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      await expect(plate).toBeDisabled();
      await expect(body.getByRole('spinbutton', { name: 'Year' })).toBeDisabled();
    });
    await waitFor(() => expect(body.getByRole('alert')).toHaveTextContent(/could not be saved/), {
      timeout: 3_000,
    });
    await expect(plate).toBeEnabled();
    await expect(plate).toHaveValue('CB 7777 XX');
    await waitFor(() =>
      expect(body.getByRole('dialog', { name: `Edit ${edited.plate}` })).toContainElement(
        canvasElement.ownerDocument.activeElement instanceof HTMLElement
          ? canvasElement.ownerDocument.activeElement
          : null,
      ),
    );
  },
};

export const DuplicateFleetNumber: Story = {
  name: 'Duplicate fleet number',
  render: exampleAt(`vehicles?drawer=${edited.id}`),
  play: async ({ canvasElement }) => {
    const duplicate = sampleVehicles[1];
    if (!duplicate) {
      throw new Error('Missing duplicate sample.');
    }
    const body = await drawerReady(canvasElement, `Edit ${edited.plate}`);
    const fleetNumber = body.getByRole('textbox', { name: 'Fleet number' });
    await userEvent.clear(fleetNumber);
    await userEvent.type(fleetNumber, duplicate.fleetNumber);
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(
      async () => {
        await expect(fleetNumber).toBeEnabled();
        await expect(fleetNumber).toHaveAttribute('aria-invalid', 'true');
        await expect(fleetNumber).toHaveFocus();
      },
      { timeout: 3_000 },
    );
    await waitFor(() =>
      expect(body.getByText('This fleet number is already used in the branch.')).toBeVisible(),
    );
  },
};

export const OptionalSpecification: Story = {
  name: 'Create with optional specification empty',
  render: exampleAt('vehicles?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'New vehicle');
    await userEvent.type(body.getByRole('textbox', { name: /License plate/ }), 'AA 0001 XX');
    await userEvent.click(body.getByRole('button', { name: 'Create vehicle' }));
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('button', { name: 'Open AA 0001 XX' })).toBeVisible(),
      { timeout: 3_000 },
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for AA 0001 XX' }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Edit');
    await drawerReady(canvasElement, 'Edit AA 0001 XX');
    await expect(body.getByRole('spinbutton', { name: 'Year' })).toHaveDisplayValue('');
    await expect(body.getByRole('combobox', { name: 'Type' })).toHaveTextContent('None');
    await expect(body.getByRole('combobox', { name: 'Fuel' })).toHaveTextContent('None');
    await expect(body.getByRole('textbox', { name: 'Make' })).toHaveValue('');
  },
};

export const HistoryPreventsDelete: Story = {
  name: 'History prevents deletion',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [trigger] = canvas.getAllByRole('button', { name: /^Actions for / });
    if (!trigger) {
      throw new Error('Missing vehicle action.');
    }
    const plate = (trigger.getAttribute('aria-label') ?? '').replace('Actions for ', '');
    await userEvent.click(trigger);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('alertdialog', { name: 'Delete vehicles?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(
        body.getByText(
          'Vehicles with trackers or history cannot be deleted. Deactivate them instead.',
        ),
      ).toBeVisible(),
    );
    await expect(canvas.getByRole('button', { name: `Open ${plate}` })).toBeVisible();
  },
};

export const SortAdditionalFields: Story = {
  name: 'Sort by fields from the contract',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Fleet number');
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).queryByRole('menu')).toBeNull(),
    );
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Descending');
    const expected = [...sampleVehicles].sort((a, b) =>
      b.fleetNumber.localeCompare(a.fleetNumber, 'en'),
    )[0];
    if (!expected) {
      throw new Error('Missing sample.');
    }
    await waitFor(() =>
      expect(
        within(canvas.getAllByRole('row')[1] ?? canvasElement).getByRole('button', {
          name: `Open ${expected.plate}`,
        }),
      ).toBeVisible(),
    );
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Updated');
    const updated = [...sampleVehicles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!updated) {
      throw new Error('Missing updated sample.');
    }
    await waitFor(() =>
      expect(
        within(canvas.getAllByRole('row')[1] ?? canvasElement).getByRole('button', {
          name: `Open ${updated.plate}`,
        }),
      ).toBeVisible(),
    );
  },
};

export const DeactivationUpdatesSort: Story = {
  name: 'Deactivation updates the modification sort',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const newestFirst = [...sampleVehicles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const vehicle = newestFirst.slice(1, 20).find((item) => item.status !== 'INACTIVE');
    if (!vehicle) {
      throw new Error('Missing an older active vehicle on the first page.');
    }
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Updated');
    await waitFor(() => expect(body.queryByRole('menu')).toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Descending');
    await waitFor(() => expect(body.queryByRole('menu')).toBeNull());
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: `Actions for ${vehicle.plate}` })).toBeVisible(),
    );
    await expect(canvas.getAllByRole('row')[1]).not.toHaveTextContent(vehicle.plate);
    await userEvent.click(canvas.getByRole('button', { name: `Actions for ${vehicle.plate}` }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Deactivate');
    await waitFor(async () => {
      const first = canvas.getAllByRole('row')[1];
      if (!first) {
        throw new Error('Missing the first vehicle row.');
      }
      await expect(
        within(first).getByRole('button', { name: `Open ${vehicle.plate}` }),
      ).toBeVisible();
      await expect(within(first).getByText('Inactive', { exact: true })).toBeVisible();
    });
  },
};

export const ContractStates: Story = {
  name: 'Asset, full vehicle types and stale fuel',
  render: exampleAt('vehicles?scenario=contract-states'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(canvas.getByText('Asset', { exact: true })).toBeVisible();
    await expect(canvas.getByText(/^Trailer/)).toBeVisible();
    await expect(canvas.getByText(/^Other/)).toBeVisible();
    await expect(canvas.getAllByText('Stale reading').length).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole('button', { name: `Actions for ${edited.plate}` }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Edit');
    const body = await drawerReady(canvasElement, `Edit ${edited.plate}`);
    await expect(body.getByRole('combobox', { name: 'Fuel' })).toHaveTextContent('CNG');
  },
};

export const Loading: Story = {
  render: exampleAt('vehicles?scenario=loading'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(within(canvasElement).getByRole('status', { name: 'Loading…' })).toBeVisible(),
      appReady,
    );
  },
};
export const Empty: Story = {
  render: exampleAt('vehicles?scenario=empty'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(within(canvasElement).getByText('No vehicles yet')).toBeVisible(),
      appReady,
    );
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: exampleAt('vehicles?scenario=error'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(within(canvasElement).getByText('The vehicles could not be loaded.')).toBeVisible(),
      appReady,
    );
  },
};

export const Mobile: Story = {
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    await tableReady(canvasElement);
  },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    await tableReady(canvasElement);
  },
  globals: { theme: 'dark' },
};
