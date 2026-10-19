import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { enterNumber } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import {
  sampleNow,
  sampleServiceTasks,
  sampleVehicles,
} from '../../../../storybook/samples/fleet-samples';

const meta: Meta = { title: 'Examples/Fleet/Odometer', tags: ['!autodocs'] };
export default meta;
type Story = StoryObj;
const vehicle = sampleVehicles.find(
  (item) =>
    item.status === 'ACTIVE' &&
    item.lastReportedAt &&
    Date.parse(item.lastReportedAt) < sampleNow - 60_000,
);
if (!vehicle) {
  throw new Error('No active sample vehicle with an earlier odometer reading.');
}
const path = `vehicles/${vehicle.id}?drawer=odometer`;
const appReady = { timeout: 10_000 };

async function ready(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(
    () => expect(body.getByRole('dialog', { name: /Record odometer/ })).toBeVisible(),
    appReady,
  );
  return body;
}

async function enterKm(canvasElement: HTMLElement, value: number) {
  const body = await ready(canvasElement);
  const input = body.getByRole('spinbutton', { name: /Odometer, km/ });
  await enterNumber(input, value);
  return { body, input };
}

export const Default: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
  },
};
export const Calendar: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const body = await ready(canvasElement);
    await userEvent.click(body.getByRole('combobox', { name: /Reading time/ }));
    await waitFor(() => expect(body.getByRole('grid')).toBeVisible());
  },
};
export const InactiveVehicle: Story = {
  render: exampleAt(
    `vehicles/${sampleVehicles.find((item) => item.status === 'INACTIVE')?.id ?? 'missing'}?drawer=odometer`,
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByText('Inactive', { exact: true })).toBeVisible(),
      appReady,
    );
    await expect(body.queryByRole('button', { name: 'Record odometer' })).toBeNull();
    await expect(body.queryByRole('dialog')).toBeNull();
  },
};
export const NoPreviousReading: Story = {
  render: exampleAt(`${path}&scenario=no-odometer`),
  play: async ({ canvasElement }) => {
    const { body } = await enterKm(canvasElement, 0);
    await expect(body.getByText('No previous odometer reading.')).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: 'Record reading' }));
    await waitFor(() => expect(body.getByText('Odometer reading recorded.')).toBeVisible());
  },
};
export const Saved: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const { body } = await enterKm(canvasElement, vehicle.odometerKm + 10.5);
    await userEvent.click(body.getByRole('button', { name: 'Record reading' }));
    await waitFor(() => expect(body.getByText('Odometer reading recorded.')).toBeVisible());
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
    await userEvent.click(body.getByRole('button', { name: 'Record odometer' }));
    await ready(canvasElement);
    await expect(body.getByText('Manual', { exact: true })).toBeVisible();
  },
};
const serviceTask = sampleServiceTasks.find((task) => task.id === 's003');
if (!serviceTask || serviceTask.dueKm === null) {
  throw new Error('Missing odometer service fixture.');
}
const serviceDueKm = serviceTask.dueKm;

export const ServicePlanUpdated: Story = {
  name: 'Reading updates the service plan',
  render: exampleAt(`vehicles/${serviceTask.vehicleId}?tab=service`),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const task = await canvas.findByRole('row', { name: new RegExp(serviceTask.kind) }, appReady);
    await expect(within(task).getByText('300 km left')).toBeVisible();
    await expect(within(task).getByText('Due soon', { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Record odometer' }));
    const { body } = await enterKm(canvasElement, serviceDueKm + 100);
    await userEvent.click(body.getByRole('button', { name: 'Record reading' }));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
    await waitFor(async () => {
      const updated = canvas.getByRole('row', { name: new RegExp(serviceTask.kind) });
      await expect(within(updated).getByText('100 km over')).toBeVisible();
      await expect(within(updated).getByText('Overdue', { exact: true })).toBeVisible();
    });
  },
};
export const LowerReading: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const { body, input } = await enterKm(canvasElement, vehicle.odometerKm - 1);
    await userEvent.click(body.getByRole('button', { name: 'Record reading' }));
    await waitFor(() =>
      expect(body.getByText('The odometer cannot be lower than the latest reading.')).toBeVisible(),
    );
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(input).toHaveFocus());
  },
};
export const SaveError: Story = {
  render: exampleAt(`${path}&scenario=save-error`),
  play: async ({ canvasElement }) => {
    const { body, input } = await enterKm(canvasElement, vehicle.odometerKm + 12);
    const draft = input instanceof HTMLInputElement ? input.value : '';
    await userEvent.click(body.getByRole('button', { name: 'Record reading' }));
    await waitFor(() => expect(input).toBeDisabled());
    await waitFor(() => expect(body.getByText(/The reading could not be saved/)).toBeVisible());
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue(draft);
    await userEvent.click(body.getByRole('button', { name: 'Record reading' }));
    await waitFor(() => expect(body.getByText('Odometer reading recorded.')).toBeVisible());
  },
};
export const FutureReading: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const body = await ready(canvasElement);
    const input = body.getByRole('combobox', { name: /Reading time/ });
    await userEvent.clear(input);
    await userEvent.type(input, '2026-10-19 10:00:00');
    await userEvent.tab();
    await userEvent.click(body.getByRole('button', { name: 'Record reading' }));
    await waitFor(() =>
      expect(
        body.getByText('The reading cannot be later than the latest vehicle data or now.'),
      ).toBeVisible(),
    );
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};
export const EarlierReading: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const body = await ready(canvasElement);
    const input = body.getByRole('combobox', { name: /Reading time/ });
    await userEvent.clear(input);
    await userEvent.type(input, '2020-01-01 10:00:00');
    await userEvent.tab();
    await userEvent.click(body.getByRole('button', { name: 'Record reading' }));
    await waitFor(() =>
      expect(
        body.getByText('Use a time after the latest odometer reading of this vehicle.'),
      ).toBeVisible(),
    );
  },
};
export const DiscardDraft: Story = {
  render: exampleAt(path),
  play: async ({ canvasElement }) => {
    const { body } = await enterKm(canvasElement, vehicle.odometerKm + 1);
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.getByRole('button', { name: 'Keep editing' })).toBeVisible());
    await userEvent.click(body.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(body.queryByRole('button', { name: 'Keep editing' })).toBeNull());
    await expect(body.getByRole('dialog', { name: /Record odometer/ })).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(body.getByRole('button', { name: 'Discard changes' })).toBeVisible(),
    );
    await userEvent.click(body.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
  },
};
export const Mobile: Story = {
  render: exampleAt(path),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { render: exampleAt(path), globals: { theme: 'dark' } };
