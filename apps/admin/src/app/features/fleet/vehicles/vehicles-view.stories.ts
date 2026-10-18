import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleVehicles } from '../../../../storybook/samples/fleet-samples';

/**
 * The Vehicles example inside the shell, with sample data: quick search, the filter builder,
 * sorting, paging, row and bulk actions, and editing in the right-hand drawer (a row opens
 * straight into its form). The sidebar leads to the other example pages.
 */
const meta: Meta = {
  title: 'Examples/Fleet/Vehicles',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [edited] = sampleVehicles;
if (!edited) throw new Error('The sample fleet is empty.');
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
    if (!first) throw new Error('No row actions');
    await userEvent.click(first);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('menuitem', { name: 'Delete' })).toBeVisible());
  },
};

/** Selected rows show the bulk actions docked at the bottom, without moving the table. */
export const BulkSelection: Story = {
  name: 'Bulk selection',
  render: exampleAt('vehicles'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const boxes = canvas.getAllByRole('checkbox', { name: /^Select (?!all)/ });
    for (const box of boxes.slice(0, 3)) await userEvent.click(box);
    await waitFor(() => expect(canvas.getByText('3 selected')).toBeVisible());
  },
};

/** Direct edit: the row opens straight into the form in the drawer. */
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
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body.getByRole('alert')).toHaveTextContent(/could not be saved/), {
      timeout: 3_000,
    });
  },
};

export const Loading: Story = { render: exampleAt('vehicles?scenario=loading') };
export const Empty: Story = { render: exampleAt('vehicles?scenario=empty') };
export const ErrorState: Story = { name: 'Error', render: exampleAt('vehicles?scenario=error') };

export const Mobile: Story = {
  render: exampleAt('vehicles'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt('vehicles'),
  globals: { theme: 'dark' },
};
