import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleAt } from '../../../../storybook/samples/example-app';
import {
  sampleAlerts,
  sampleServiceTasks,
  sampleTrips,
  sampleVehicles,
} from '../../../../storybook/samples/fleet-samples';

/**
 * The vehicle profile: a full page for one record with Edit (the vehicle drawer), KPIs and tabs
 * for the overview, trips (open the trip drawer), alerts (open the Alerts page) and the service
 * plan. Sample data, inside the shell; the back link returns to the Vehicles example.
 */
const meta: Meta = {
  title: 'Examples/Fleet/Vehicle profile',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const vehicle = sampleVehicles.find(
  (item) =>
    sampleTrips.some((trip) => trip.vehicleId === item.id) &&
    sampleAlerts.some((alert) => alert.vehicleId === item.id) &&
    sampleServiceTasks.some((task) => task.vehicleId === item.id),
);
if (!vehicle) throw new Error('No sample vehicle has trips, alerts and service tasks.');
const profile = `vehicles/${vehicle.id}`;
const plate = vehicle.plate;
const appReady = { timeout: 10_000 };

async function pageReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () => expect(canvas.getByRole('heading', { level: 1, name: plate })).toBeVisible(),
    appReady,
  );
  return canvas;
}

export const Overview: Story = {
  render: exampleAt(profile),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    await expect(canvas.getByRole('figure', { name: /Distance per day/ })).toBeVisible();
  },
};

/**
 * The breadcrumb names the record: Fleet › Vehicles (a link back to the list) › the plate. The
 * sidebar has a Vehicles link too, so every query stays inside the breadcrumb.
 */
export const BreadcrumbBack: Story = {
  name: 'Breadcrumb back to the list',
  render: exampleAt(profile),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    const breadcrumb = () => within(canvas.getByRole('navigation', { name: 'Breadcrumb' }));
    await waitFor(() =>
      expect(breadcrumb().getByText(plate)).toHaveAttribute('aria-current', 'page'),
    );
    await userEvent.click(breadcrumb().getByRole('link', { name: 'Vehicles' }));
    await waitFor(() => expect(breadcrumb().queryByRole('link')).toBeNull(), appReady);
    await expect(breadcrumb().getByText('Vehicles')).toHaveAttribute('aria-current', 'page');
  },
};

export const TripsTab: Story = {
  name: 'Trips tab',
  render: exampleAt(`${profile}?tab=trips`),
  play: async ({ canvasElement }) => {
    const canvas = await pageReady(canvasElement);
    const [first] = canvas.getAllByRole('button', { name: /2026/ });
    if (!first) throw new Error('No trips');
    await userEvent.click(first);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog')).toBeVisible());
  },
};

export const AlertsTab: Story = {
  name: 'Alerts tab',
  render: exampleAt(`${profile}?tab=alerts`),
  play: async ({ canvasElement }) => {
    await pageReady(canvasElement);
  },
};

export const ServiceTab: Story = {
  name: 'Service tab',
  render: exampleAt(`${profile}?tab=service`),
  play: async ({ canvasElement }) => {
    await pageReady(canvasElement);
  },
};

/** Edit opens the same vehicle drawer as the list. */
export const Edit: Story = {
  render: exampleAt(`${profile}?drawer=edit`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: `Edit ${plate}` })).toBeVisible(),
      appReady,
    );
  },
};

export const Saved: Story = {
  render: exampleAt(`${profile}?drawer=edit`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: `Edit ${plate}` })).toBeVisible(),
      appReady,
    );
    await userEvent.type(
      body.getByRole('textbox', { name: 'Notes' }),
      ' Updated from the profile.',
    );
    await userEvent.click(body.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body.getByText(`${plate} was saved.`)).toBeVisible());
    await expect(body.getByText(`${plate} was saved.`).closest('.p-toast-message')).not.toBeNull();
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
  },
};

export const Loading: Story = { render: exampleAt(`${profile}?scenario=loading`) };
export const NotFound: Story = {
  name: 'Not found',
  render: exampleAt('vehicles/no-such-vehicle'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Vehicle not found')).toBeVisible(), appReady);
  },
};
export const ErrorState: Story = { name: 'Error', render: exampleAt(`${profile}?scenario=error`) };

export const Mobile: Story = {
  render: exampleAt(profile),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Dark: Story = {
  render: exampleAt(profile),
  globals: { theme: 'dark' },
};
