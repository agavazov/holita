import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { fixtureDriver } from '../../../../storybook/drivers-fixtures';
import { fixtureVehicleProfile } from '../../../../storybook/vehicle-profile-fixtures';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { DriverEditorPage } from './driver-editor-page';
import { DriverScorecardPage } from './driver-scorecard-page';
import { VehicleProfilePage } from '../vehicles/vehicle-profile-page';
import { DriversPage } from './drivers-page';

const meta: Meta = {
  title: 'Admin/Fleet/Drivers',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/drivers`;
const appReady = { timeout: 10_000 };
const name = `${fixtureDriver.firstName} ${fixtureDriver.lastName}`;

function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [
        StoryApp,
        AdminWorkspace,
        FleetWorkspace,
        DriversPage,
        DriverEditorPage,
        DriverScorecardPage,
        VehicleProfilePage,
      ],
    },
    template: '<holita-story-app [url]="url" />',
  });
}

async function tableReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () => expect(canvas.getByRole('button', { name: `Open ${name}` })).toBeVisible(),
    appReady,
  );
  return canvas;
}

export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1, name: /^Drivers/ })).toBeVisible();
    await expect(canvas.getByText('E-004', { exact: true })).toBeVisible();
    await expect(canvas.getByText('No score', { exact: true })).toBeVisible();
  },
};

export const AssignedVehicle: Story = {
  name: 'Assigned vehicle profile',
  render: routed(`/${fixtureDriver.id}`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
    await userEvent.click(
      within(body.getByRole('dialog', { name })).getByRole('link', {
        name: fixtureVehicleProfile.licensePlate,
      }),
    );
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByRole('heading', {
            level: 1,
            name: fixtureVehicleProfile.licensePlate,
          }),
        ).toBeVisible(),
      appReady,
    );
    await expect(body.queryByRole('dialog')).toBeNull();
  },
};

export const Edit: Story = {
  render: routed(`/${fixtureDriver.id}/edit?keep=drivers#drivers`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const title = `Edit ${name}`;
    await waitFor(() => expect(body.getByRole('dialog', { name: title })).toBeVisible(), appReady);
    const drawer = within(body.getByRole('dialog', { name: title }));
    await waitFor(
      () => expect(drawer.getByRole('textbox', { name: /^First name/ })).toHaveValue('Elena'),
      appReady,
    );
    await expect(drawer.getByRole('textbox', { name: 'Employee number' })).toHaveValue('E-004');
    await expect(drawer.getByRole('textbox', { name: 'Identification key' })).toHaveValue(
      'KEY-004',
    );
    await expect(drawer.getByRole('textbox', { name: 'Tachograph card number' })).toHaveValue(
      'BG12345678',
    );
    await userEvent.clear(drawer.getByRole('textbox', { name: 'Notes' }));
    await userEvent.type(
      drawer.getByRole('textbox', { name: 'Notes' }),
      'Saved through the live Driver adapter.',
    );
    await userEvent.click(drawer.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => expect(body.queryByRole('dialog', { name: title })).toBeNull(), appReady);
    await waitFor(() => expect(body.getByText(`${name} was saved.`)).toBeVisible(), appReady);
    await tableReady(canvasElement);
  },
};

export const ReadEditCancel: Story = {
  name: 'Read, edit and discard',
  render: routed(`/${fixtureDriver.id}?keep=drivers#drivers`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
    await waitFor(
      () =>
        expect(
          within(body.getByRole('dialog', { name })).getByText(/International line/),
        ).toBeVisible(),
      appReady,
    );
    await userEvent.click(
      within(body.getByRole('dialog', { name })).getByRole('button', { name: /^Edit$/ }),
    );
    const title = `Edit ${name}`;
    await waitFor(() => expect(body.getByRole('dialog', { name: title })).toBeVisible(), appReady);
    const drawer = within(body.getByRole('dialog', { name: title }));
    await waitFor(
      () => expect(drawer.getByRole('textbox', { name: 'Notes' })).toHaveValue(fixtureDriver.notes),
      appReady,
    );
    await userEvent.type(drawer.getByRole('textbox', { name: 'Notes' }), ' Discard me');
    await userEvent.click(drawer.getByRole('button', { name: /^Cancel$/ }));
    const confirmation = await body.findByRole('alertdialog', { name: 'Unsaved changes' });
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(body.getByRole('dialog', { name })).toBeVisible(), appReady);
    await waitFor(
      () =>
        expect(
          within(body.getByRole('dialog', { name })).getByText(/International line/),
        ).toBeVisible(),
      appReady,
    );
    const note = within(body.getByRole('dialog', { name })).getByText(/International line/);
    await expect(note.textContent).toBe(fixtureDriver.notes);
  },
};

export const ScorecardPeriods: Story = {
  name: 'Scorecard 7, 30 and 90 days',
  render: routed(`/${fixtureDriver.id}/scorecard?days=30&keep=drivers&page=2#drivers`),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('heading', { level: 1, name })).toBeVisible(),
      appReady,
    );
    await expect(canvas.getByRole('button', { name: '30 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const days of [7, 90]) {
      await userEvent.click(canvas.getByRole('button', { name: `${String(days)} days` }));
      await waitFor(async () => {
        await expect(canvas.getByRole('button', { name: `${String(days)} days` })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      }, appReady);
    }
    const back = canvas.getByRole('link', { name: 'Back to drivers' });
    await expect(back.getAttribute('href')).toContain('keep=drivers');
    await expect(back.getAttribute('href')).toContain('page=2');
    await expect(back.getAttribute('href')).toContain('#drivers');
    await userEvent.click(back);
    await tableReady(canvasElement);
  },
};

export const ProtectedDelete: Story = {
  name: 'Protected deletion',
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Actions for ${name}` }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const body = within(canvasElement.ownerDocument.body);
    const confirmation = await body.findByRole('alertdialog', { name: 'Delete drivers?' });
    await userEvent.click(within(confirmation).getByRole('button', { name: /^Delete$/ }));
    await waitFor(
      () => expect(body.getByText('Drivers deleted: 0. Failed: 1.')).toBeVisible(),
      appReady,
    );
    await expect(canvas.getByRole('button', { name: `Open ${name}` })).toBeVisible();
  },
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminDrivers: 'network' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(within(canvasElement).getByRole('alert')).toHaveTextContent('fixture-AdminDrivers'),
      appReady,
    );
  },
};
