import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleServiceTasks } from '../../../../storybook/samples/fleet-samples';

/**
 * The Maintenance example: service tasks due by date and/or odometer, urgency and cost, the
 * list's actions in the row menu and the bulk bar (Mark as done and Delete), and direct edit in
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

/** Mark as done is a quick bulk change: no confirmation, and the first page holds open tasks. */
export const CompleteSelected: Story = {
  name: 'Mark selected as done',
  render: exampleAt('maintenance'),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    const boxes = canvas.getAllByRole('checkbox', { name: /^Select (?!all)/ });
    for (const box of boxes.slice(0, 3)) await userEvent.click(box);
    const bar = await canvas.findByRole('region', { name: 'Actions for selected records' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Mark as done' }));
    await waitFor(() => expect(canvas.getByText('Service tasks marked as done: 3.')).toBeVisible());
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
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body.getByRole('alert')).toHaveTextContent(/could not be saved/), {
      timeout: 3_000,
    });
  },
};

export const Loading: Story = { render: exampleAt('maintenance?scenario=loading') };
export const Empty: Story = { render: exampleAt('maintenance?scenario=empty') };
export const ErrorState: Story = { name: 'Error', render: exampleAt('maintenance?scenario=error') };

export const Mobile: Story = {
  render: exampleAt('maintenance'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt(`maintenance?drawer=${task.id}`),
  globals: { theme: 'dark' },
};
