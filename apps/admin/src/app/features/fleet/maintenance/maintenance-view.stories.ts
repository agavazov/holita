import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem, enterNumber } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import {
  sampleServiceTasks,
  sampleVehicles,
  vehicleById,
} from '../../../../storybook/samples/fleet-samples';

/**
 * The Maintenance example: service tasks due by date and/or odometer, urgency and cost, the
 * list's actions in the row menu and the bulk bar (Delete), and direct edit in
 * the drawer (a date or an odometer reading is required).
 */
const meta: Meta = {
  title: 'Examples/Service/Maintenance',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [task] = sampleServiceTasks;
if (!task) throw new Error('The sample service tasks are empty.');
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

async function pageReady(canvasElement: HTMLElement) {
  await waitFor(
    () =>
      expect(
        within(canvasElement).getByRole('heading', { level: 1, name: /Maintenance/ }),
      ).toBeVisible(),
    appReady,
  );
}

export const Default: Story = {
  render: exampleAt('maintenance'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(
      canvas.getAllByText('Overdue', { selector: '.p-tag-label' }).length,
    ).toBeGreaterThan(0);
  },
};

/**
 * Delete from the row menu asks about that task by name; Cancel returns the focus to the row's
 * "⋮" button.
 */
export const DeleteFromRow: Story = {
  name: 'Delete from a row',
  render: exampleAt('maintenance'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const [trigger] = canvas.getAllByRole('button', { name: /^Actions for / });
    if (!trigger) throw new Error('No row actions');
    const name = (trigger.getAttribute('aria-label') ?? '').replace('Actions for ', '');
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const dialog = await body.findByRole('alertdialog', { name: 'Delete service tasks?' });
    await expect(within(dialog).getByRole('listitem')).toHaveTextContent(name);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** The same Delete from the bulk bar lists the selected tasks; afterwards focus is on the list. */
export const DeleteSelected: Story = {
  name: 'Delete selected',
  render: exampleAt('maintenance'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const boxes = canvas.getAllByRole('checkbox', { name: /^Select (?!all)/ });
    for (const box of boxes.slice(0, 3)) await userEvent.click(box);
    const bar = await canvas.findByRole('region', { name: 'Actions for selected records' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Delete' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('alertdialog', { name: 'Delete service tasks?' });
    await expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(canvas.getByText('Service tasks deleted: 3.')).toBeVisible());
    await waitFor(() =>
      expect(canvas.getByRole('heading', { level: 2, name: /^Service tasks/ })).toHaveFocus(),
    );
  },
};

export const Edit: Story = {
  render: exampleAt(`maintenance?drawer=${task.id}`),
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement, `Edit ${task.kind}`);
  },
};

/** A task needs a date or an odometer reading; saving without either says so. */
export const ScheduleRequired: Story = {
  name: 'Schedule required',
  render: exampleAt('maintenance?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'New service task');
    await userEvent.type(body.getByRole('textbox', { name: /^Task/ }), 'Brake check');
    await userEvent.click(body.getByRole('button', { name: 'Plan task' }));
    await waitFor(() => expect(body.getAllByRole('alert').length).toBeGreaterThan(0));
  },
};

export const SaveError: Story = {
  name: 'Save error',
  render: exampleAt(`maintenance?scenario=save-error&drawer=${task.id}`),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, `Edit ${task.kind}`);
    const title = body.getByRole('textbox', { name: 'Task title' });
    await userEvent.type(title, ' draft');
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(title).toBeDisabled());
    await waitFor(() => expect(body.getByRole('alert')).toHaveTextContent(/could not be saved/), {
      timeout: 3_000,
    });
    await expect(title).toBeEnabled();
    await expect(title).toHaveValue(`${task.title ?? ''} draft`);
    await waitFor(() =>
      expect(body.getByRole('dialog').contains(canvasElement.ownerDocument.activeElement)).toBe(
        true,
      ),
    );
  },
};

export const PlanWithoutTitle: Story = {
  name: 'Plan by service type without a title',
  render: exampleAt('maintenance?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = await drawerReady(canvasElement, 'New service task');
    const serviceType = body.getByRole('combobox', { name: 'Service type' });
    await userEvent.click(serviceType);
    await userEvent.click(await body.findByRole('option', { name: 'Repair' }));
    await waitFor(() => expect(serviceType).toHaveTextContent('Repair'));
    await waitFor(() => expect(body.queryByRole('listbox')).not.toBeInTheDocument());
    const vehicle = sampleVehicles.find((item) => item.status !== 'INACTIVE');
    if (!vehicle) throw new Error('No serviceable vehicle fixture.');
    const vehicleSelect = body.getByRole('combobox', { name: 'Vehicle' });
    await userEvent.click(vehicleSelect);
    await userEvent.click(
      await body.findByRole('option', {
        name: `${vehicle.plate} · ${vehicle.make} ${vehicle.model}`,
      }),
    );
    await waitFor(() => expect(vehicleSelect).toHaveTextContent(vehicle.plate));
    await enterNumber(body.getByRole('spinbutton', { name: 'Due at odometer, km' }), 9_999_999);
    await userEvent.type(
      body.getByRole('textbox', { name: 'Workshop' }),
      'Example repair workshop',
    );
    await userEvent.click(body.getByRole('button', { name: 'Plan task' }));
    await waitFor(() => expect(body.getByText('Repair was planned.')).toBeVisible(), {
      timeout: 3_000,
    });
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('searchbox'), 'Example repair workshop');
    await waitFor(() => expect(canvas.getAllByRole('row')).toHaveLength(2));
    await expect(canvas.getByRole('button', { name: /^Edit Repair on / })).toBeVisible();
  },
};

export const CancelService: Story = {
  name: 'Cancel service and inspect the retained plan',
  render: exampleAt('maintenance'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const plate = vehicleById(task.vehicleId)?.plate ?? '—';
    await userEvent.click(
      canvas.getByRole('button', { name: `Actions for ${task.kind} on ${plate}` }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Cancel service');
    await waitFor(() => expect(body.getByText('Service tasks cancelled: 1.')).toBeVisible());
    await userEvent.type(canvas.getByRole('searchbox'), task.kind);
    await userEvent.click(
      await canvas.findByRole('button', { name: `View cancelled ${task.kind} on ${plate}` }),
    );
    await drawerReady(canvasElement, `Cancelled ${task.kind}`);
    await expect(body.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    await expect(body.getByText('Oil change', { exact: true })).toBeVisible();
  },
};

export const UnknownOdometer: Story = {
  name: 'Tasks without known vehicle odometers',
  render: exampleAt('maintenance?scenario=no-odometer'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(
      canvas.getAllByText('Unknown odometer', { selector: '.p-tag-label' }).length,
    ).toBeGreaterThan(0);
    await expect(canvas.queryByText(/km left|km over/)).not.toBeInTheDocument();
  },
};

export const AddedSort: Story = {
  name: 'Sort by the task creation date',
  render: exampleAt('maintenance'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Added');
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).queryByRole('menu')).not.toBeInTheDocument(),
    );
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Descending');
    const first = sampleServiceTasks.find((item) => item.id === 's001');
    if (!first) throw new Error('Missing latest created task.');
    const plate = vehicleById(first.vehicleId)?.plate ?? '—';
    await waitFor(() =>
      expect(canvas.getAllByRole('button', { name: /^Actions for / })[0]).toHaveAccessibleName(
        `Actions for ${first.kind} on ${plate}`,
      ),
    );
  },
};

export const Loading: Story = {
  render: exampleAt('maintenance?scenario=loading'),
  play: async ({ canvasElement }) => {
    await pageReady(canvasElement);
  },
};
export const Empty: Story = {
  render: exampleAt('maintenance?scenario=empty'),
  play: async ({ canvasElement }) => {
    await pageReady(canvasElement);
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: exampleAt('maintenance?scenario=error'),
  play: async ({ canvasElement }) => {
    await pageReady(canvasElement);
  },
};

export const Mobile: Story = {
  render: exampleAt('maintenance'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: async ({ canvasElement }) => {
    await pageReady(canvasElement);
  },
};

export const Dark: Story = {
  render: exampleAt(`maintenance?drawer=${task.id}`),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement, `Edit ${task.kind}`);
  },
};
