import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleServiceTasks } from '../../../../storybook/samples/fleet-samples';

/**
 * The Maintenance example: service tasks due by date and/or odometer, urgency and cost, row and
 * bulk actions, and direct edit in the drawer (a date or an odometer reading is required).
 */
const meta: Meta = {
  title: 'Examples/Service/Maintenance',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [task] = sampleServiceTasks;
if (!task) throw new Error('The sample service tasks are empty.');
const appReady = { timeout: 10_000 };

async function drawerReady(canvasElement: HTMLElement, name: string) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
  return body;
}

export const Default: Story = {
  render: exampleAt('maintenance'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
    await expect(
      canvas.getAllByText('Overdue', { selector: '.p-tag-label' }).length,
    ).toBeGreaterThan(0);
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
