import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem, enterNumber } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleServiceTasks, vehicleById } from '../../../../storybook/samples/fleet-samples';

const task = sampleServiceTasks.find((item) => item.id === 's001');
if (!task) throw new Error('Missing completion sample.');
const path = `maintenance?drawer=complete-${task.id}`;
const title = `Complete ${task.kind}`;
const ready = { timeout: 10_000 };

const meta: Meta = {
  title: 'Examples/Service/Service completion',
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;

async function drawerReady(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(body.getByRole('dialog', { name: title })).toBeVisible(), ready);
  return within(body.getByRole('dialog', { name: title }));
}

export const Default: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement);
    await expect(drawer.getByRole('combobox', { name: /^Completion date/ })).not.toHaveValue('');
    await expect(drawer.getByRole('spinbutton', { name: 'Completion odometer, km' })).toHaveValue(
      '',
    );
  },
};

/** The row action opens a form; completion is deliberately absent from the bulk bar. */
export const CompleteFromRow: Story = {
  name: 'Complete from a row',
  render: exampleAt('maintenance'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), ready);
    const trigger = canvas.getAllByRole('button', { name: /^Actions for / })[0];
    if (!trigger) throw new Error('Missing service row action.');
    await userEvent.click(trigger);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Complete service');
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', { name: /^Complete / });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Complete service' }));
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(body.getByText(/was completed\.$/)).toBeVisible());
  },
};

export const CompleteAndPlanNext: Story = {
  name: 'Complete and plan next',
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement);
    await enterNumber(drawer.getByRole('spinbutton', { name: 'Completion odometer, km' }), 120000);
    await enterNumber(drawer.getByRole('spinbutton', { name: 'Next due odometer, km' }), 140000);
    await userEvent.type(drawer.getByRole('textbox', { name: 'Workshop' }), 'Plovdiv workshop');
    await userEvent.type(drawer.getByRole('textbox', { name: 'Replaced parts' }), 'Oil and filter');
    await userEvent.type(
      await drawer.findByRole('textbox', { name: 'Next task title' }),
      'Next oil service',
    );
    await userEvent.click(await drawer.findByRole('button', { name: 'Complete and plan next' }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.queryByRole('dialog', { name: title })).not.toBeInTheDocument(),
    );
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(body.getByText(/was completed and the next service was planned/)).toBeVisible(),
    );
    await userEvent.type(canvas.getByRole('searchbox'), 'Next oil service');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /^Edit Next oil service/ })).toBeVisible(),
    );
    await userEvent.clear(canvas.getByRole('searchbox'));
    await userEvent.type(canvas.getByRole('searchbox'), task.kind);
    const plate = vehicleById(task.vehicleId)?.plate ?? '—';
    await userEvent.click(
      canvas.getByRole('button', { name: `View completed ${task.kind} on ${plate}` }),
    );
    const record = await body.findByRole('dialog', { name: `Completed ${task.kind}` });
    await expect(within(record).getByText('Plovdiv workshop')).toBeVisible();
    await expect(within(record).getByText('Oil and filter')).toBeVisible();
    await expect(within(record).getByText('120,000')).toBeVisible();
    await expect(
      within(record).queryByRole('button', { name: 'Complete service' }),
    ).not.toBeInTheDocument();
  },
};

export const InvalidNextSchedule: Story = {
  name: 'Next service must be later',
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement);
    await enterNumber(drawer.getByRole('spinbutton', { name: 'Completion odometer, km' }), 120000);
    const next = drawer.getByRole('spinbutton', { name: 'Next due odometer, km' });
    await enterNumber(next, 120000);
    await userEvent.click(await drawer.findByRole('button', { name: 'Complete and plan next' }));
    await waitFor(() => expect(next).toHaveFocus());
    await expect(next).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() =>
      expect(
        drawer.getByText('The next due odometer must be above the completion odometer.'),
      ).toBeVisible(),
    );
  },
};

export const SaveError: Story = {
  name: 'Save error and retry',
  render: exampleAt(`${path}&scenario=completion-error`),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement);
    const workshop = drawer.getByRole('textbox', { name: 'Workshop' });
    await userEvent.type(workshop, 'Plovdiv workshop');
    await userEvent.click(drawer.getByRole('button', { name: 'Complete service' }));
    await expect(workshop).toBeDisabled();
    await waitFor(
      () => expect(drawer.getByRole('alert')).toHaveTextContent(/could not be completed/),
      { timeout: 3_000 },
    );
    await expect(workshop).toBeEnabled();
    await expect(workshop).toHaveValue('Plovdiv workshop');
    await userEvent.click(drawer.getByRole('button', { name: 'Complete service' }));
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole('dialog', { name: title }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).getByText(/was completed\.$/)).toBeVisible(),
    );
  },
};

export const EarlierServiceOdometer: Story = {
  name: 'Earlier service odometer error',
  render: exampleAt(`${path}&scenario=earlier-service`),
  play: async ({ canvasElement }) => {
    const drawer = await drawerReady(canvasElement);
    const odometer = drawer.getByRole('spinbutton', { name: 'Completion odometer, km' });
    await enterNumber(odometer, 120000);
    await userEvent.click(drawer.getByRole('button', { name: 'Complete service' }));
    await waitFor(() => expect(odometer).toHaveAttribute('aria-invalid', 'true'), {
      timeout: 3_000,
    });
    await waitFor(() => expect(odometer).toHaveFocus());
    await expect(odometer).toHaveValue('120,000');
    await waitFor(() =>
      expect(
        drawer.getByText(
          'The odometer cannot be below an earlier completed service of this vehicle.',
        ),
      ).toBeVisible(),
    );
  },
};

export const CompletedRecord: Story = {
  name: 'Completed service record',
  render: exampleAt('maintenance?drawer=complete-s023'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: /^Completed / })).toBeVisible(),
      ready,
    );
    await expect(body.getByText('Actual cost, EUR')).toBeVisible();
    await expect(body.queryByRole('button', { name: 'Complete service' })).not.toBeInTheDocument();
  },
};

export const Mobile: Story = {
  render: exampleAt(path),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement);
  },
};

export const Dark: Story = {
  render: exampleAt(path),
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await drawerReady(canvasElement);
  },
};
