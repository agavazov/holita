import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { fixtureVehicle } from '../../../../storybook/vehicles-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { VehicleEditorPage } from './vehicle-editor-page';

/** Real routes, page adapters, scoped Apollo clients and the shared Storybook presentation. */
const meta: Meta = {
  title: 'Admin/Fleet/Vehicles',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};

export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/vehicles`;
const appReady = { timeout: 10_000 };

function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    // Compile the real lazy component graph before play starts on a cold Vite server.
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, VehicleEditorPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

async function tableReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
  await waitFor(
    () =>
      expect(
        canvas.getByRole('button', { name: `Edit ${fixtureVehicle.licensePlate}` }),
      ).toBeVisible(),
    appReady,
  );
  return canvas;
}

export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1, name: /^Vehicles/ })).toBeVisible();
    await expect(canvas.getByText('Elena Petrova')).toBeVisible();
    await expect(canvas.getByText('International', { exact: true })).toBeVisible();
    await waitFor(
      () =>
        expect(canvas.getByRole('link', { name: 'Vehicles' })).toHaveAttribute(
          'aria-current',
          'page',
        ),
      appReady,
    );
  },
};

export const Edit: Story = {
  render: routed(`/${fixtureVehicle.id}/edit?keep=storybook#vehicles`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const title = `Edit ${fixtureVehicle.licensePlate}`;
    await waitFor(() => expect(body.getByRole('dialog', { name: title })).toBeVisible(), appReady);
    const drawer = within(body.getByRole('dialog', { name: title }));
    await waitFor(
      () =>
        expect(drawer.getByRole('textbox', { name: /License plate/ })).toHaveValue(
          fixtureVehicle.licensePlate,
        ),
      appReady,
    );
    await expect(drawer.getByRole('textbox', { name: 'Fleet number' })).toHaveValue('T-04');
    await expect(drawer.getByRole('textbox', { name: 'VIN' })).toHaveValue('YV2RT40A1RB123456');
    await expect(drawer.getByRole('textbox', { name: 'Make' })).toHaveValue('Volvo');
    await expect(drawer.getByRole('spinbutton', { name: 'Year' })).toHaveDisplayValue('2024');
    await waitFor(
      () =>
        expect(drawer.getByRole('combobox', { name: 'Group' })).toHaveTextContent('International'),
      appReady,
    );
    await waitFor(
      () =>
        expect(drawer.getByRole('combobox', { name: 'Driver' })).toHaveTextContent('Elena Petrova'),
      appReady,
    );
    const notes = drawer.getByRole('textbox', { name: 'Notes' });
    await userEvent.clear(notes);
    await userEvent.type(notes, 'Saved through the real page adapter.');
    await userEvent.click(drawer.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => expect(body.queryByRole('dialog', { name: title })).toBeNull(), appReady);
    await waitFor(
      () => expect(body.getByText(`${fixtureVehicle.licensePlate} was saved.`)).toBeVisible(),
      appReady,
    );
    await tableReady(canvasElement);
  },
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminVehicles: 'network' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('alert')).toHaveTextContent('fixture-AdminVehicles'),
      appReady,
    );
  },
};

export const ProtectedDelete: Story = {
  name: 'Protected deletion',
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: `Actions for ${fixtureVehicle.licensePlate}` }),
    );
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const body = within(canvasElement.ownerDocument.body);
    const confirmation = await body.findByRole('alertdialog', { name: 'Delete vehicles?' });
    await userEvent.click(within(confirmation).getByRole('button', { name: /^Delete$/ }));
    await waitFor(
      () => expect(body.getByText('Vehicles deleted: 0. Failed: 1.')).toBeVisible(),
      appReady,
    );
    await expect(
      canvas.getByRole('button', { name: `Edit ${fixtureVehicle.licensePlate}` }),
    ).toBeVisible();
  },
};

/** The fixture acknowledges the write; subsequent reads keep its immutable initial snapshot. */
export const Deactivate: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: `Actions for ${fixtureVehicle.licensePlate}` }),
    );
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Deactivate');
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText('Vehicles deactivated: 1.')).toBeVisible(), appReady);
    await tableReady(canvasElement);
  },
};
