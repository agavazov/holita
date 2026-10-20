import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { fixtureVehicleProfile } from '../../../../storybook/vehicle-profile-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { TripDetailPage } from '../trips/trip-detail-page';
import { AlertDetailPage } from '../alerts/alert-detail-page';
import { MaintenanceRecordPage } from '../maintenance/maintenance-record-page';
import { VehicleEditorPage } from './vehicle-editor-page';
import { VehicleOdometerPage } from './vehicle-odometer-page';
import { VehicleProfilePage } from './vehicle-profile-page';

const meta: Meta = {
  title: 'Admin/Fleet/Vehicle profile',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = defaultBranchId + '/fleet/vehicles/' + fixtureVehicleProfile.id;
function routed(tab = 'overview', child = ''): NonNullable<Story['render']> {
  const render = routeAt(path + '/' + tab + child);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [
        StoryApp,
        AdminWorkspace,
        FleetWorkspace,
        VehicleProfilePage,
        VehicleEditorPage,
        VehicleOdometerPage,
        TripDetailPage,
        AlertDetailPage,
        MaintenanceRecordPage,
      ],
    },
    template: '<holita-story-app [url]="url" />',
  });
}
async function ready(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () =>
      expect(
        canvas.getByRole('heading', { level: 1, name: fixtureVehicleProfile.licensePlate }),
      ).toBeVisible(),
    { timeout: 10000 },
  );
  return canvas;
}
async function closeRecord(dialog: HTMLElement): Promise<void> {
  const close = dialog.querySelector<HTMLButtonElement>('button.route-drawer__close');
  if (!close) {
    throw new Error('Missing related record Close.');
  }
  await userEvent.click(close);
  await waitFor(
    async () => {
      await expect(dialog).not.toBeInTheDocument();
    },
    { timeout: 10000 },
  );
}
export const Overview: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(
      canvas.getByRole('figure', { name: 'Distance per day, last 14 days' }),
    ).toBeVisible();
    await expect(canvas.getByText('Next service', { exact: true })).toBeVisible();
    await expect(canvas.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      fixtureVehicleProfile.licensePlate,
    );
  },
};
export const RelatedTabs: Story = {
  render: routed('trips'),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const heading = canvas.getByRole('heading', {
      level: 1,
      name: fixtureVehicleProfile.licensePlate,
    });
    await waitFor(() => expect(canvas.getByRole('button', { name: /18 Oct 2026/ })).toBeVisible(), {
      timeout: 10000,
    });
    await userEvent.click(canvas.getByRole('button', { name: /18 Oct 2026/ }));
    await waitFor(
      async () => {
        await expect(
          body.getByRole('dialog', { name: 'Trip ' + fixtureVehicleProfile.licensePlate }),
        ).toBeVisible();
      },
      { timeout: 10000 },
    );
    const trip = body.getByRole('dialog', { name: 'Trip ' + fixtureVehicleProfile.licensePlate });
    await expect(heading.isConnected).toBe(true);
    await userEvent.click(within(trip).getByRole('button', { name: 'Open vehicle' }));
    await waitFor(
      async () => {
        await expect(trip).not.toBeInTheDocument();
      },
      { timeout: 10000 },
    );
    await expect(canvas.getByRole('tab', { name: 'Trips' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      canvas.getByRole('heading', { level: 1, name: fixtureVehicleProfile.licensePlate }),
    ).toBe(heading);
    await userEvent.click(canvas.getByRole('tab', { name: 'Alerts' }));
    await waitFor(
      async () => {
        await expect(canvas.getByRole('button', { name: 'Low fuel' })).toBeVisible();
      },
      { timeout: 10000 },
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Low fuel' }));
    await waitFor(
      async () => {
        await expect(body.getByRole('dialog', { name: 'Low fuel' })).toBeVisible();
      },
      { timeout: 10000 },
    );
    await expect(heading.isConnected).toBe(true);
    await closeRecord(body.getByRole('dialog', { name: 'Low fuel' }));
    await expect(canvas.getByRole('tab', { name: 'Alerts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(canvas.getByRole('tab', { name: 'Service' }));
    await waitFor(
      async () => {
        await expect(canvas.getByRole('button', { name: 'Oil change' })).toBeVisible();
      },
      { timeout: 10000 },
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Oil change' }));
    await waitFor(
      async () => {
        await expect(body.getByRole('dialog', { name: 'Edit Oil change' })).toBeVisible();
      },
      { timeout: 10000 },
    );
    const serviceEdit = within(body.getByRole('dialog', { name: 'Edit Oil change' }));
    await waitFor(
      async () => {
        await expect(serviceEdit.getByRole('textbox', { name: 'Notes' })).toHaveValue(
          'Use the approved oil.',
        );
      },
      { timeout: 10000 },
    );
    await userEvent.type(
      serviceEdit.getByRole('textbox', { name: 'Notes' }),
      ' Retained profile draft.',
    );
    await userEvent.click(serviceEdit.getByRole('button', { name: 'Cancel' }));
    const discard = await body.findByRole('alertdialog', { name: 'Unsaved changes' });
    await userEvent.click(within(discard).getByRole('button', { name: 'Discard changes' }));
    await waitFor(
      async () => {
        await expect(body.queryByRole('dialog', { name: 'Edit Oil change' })).toBeNull();
      },
      { timeout: 10000 },
    );
    await expect(canvas.getByRole('tab', { name: 'Service' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Warranty inspection' }));
    await waitFor(
      async () => {
        await expect(
          body.getByRole('dialog', { name: 'Completed Warranty inspection' }),
        ).toBeVisible();
      },
      { timeout: 10000 },
    );
    const receipt = body.getByRole('dialog', { name: 'Completed Warranty inspection' });
    await waitFor(
      async () => {
        await expect(within(receipt).getByText('Covered by warranty.')).toBeVisible();
      },
      { timeout: 10000 },
    );
    await closeRecord(receipt);
    await expect(
      canvas.getByRole('heading', { level: 1, name: fixtureVehicleProfile.licensePlate }),
    ).toBe(heading);
    await expect(canvas.getByRole('tab', { name: 'Service' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  },
};
export const Edit: Story = {
  render: routed('overview', '/edit'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () =>
        expect(
          body.getByRole('dialog', { name: 'Edit ' + fixtureVehicleProfile.licensePlate }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    const drawer = within(
      body.getByRole('dialog', { name: 'Edit ' + fixtureVehicleProfile.licensePlate }),
    );
    await userEvent.type(drawer.getByRole('textbox', { name: 'Notes' }), ' Profile edit.');
    await userEvent.click(drawer.getByRole('button', { name: 'Save' }));
    await waitFor(
      () =>
        expect(
          body.queryByRole('dialog', { name: 'Edit ' + fixtureVehicleProfile.licensePlate }),
        ).toBeNull(),
      { timeout: 10000 },
    );
    await ready(canvasElement);
  },
};
export const Odometer: Story = {
  render: routed('overview', '/odometer'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () =>
        expect(
          body.getByRole('dialog', {
            name: 'Record odometer · ' + fixtureVehicleProfile.licensePlate,
          }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    const drawer = within(
      body.getByRole('dialog', { name: 'Record odometer · ' + fixtureVehicleProfile.licensePlate }),
    );
    await waitFor(
      () => expect(drawer.getByRole('button', { name: 'Record reading' })).toBeVisible(),
      { timeout: 10000 },
    );
    await userEvent.click(drawer.getByRole('button', { name: 'Record reading' }));
    await waitFor(
      () =>
        expect(
          body.queryByRole('dialog', {
            name: 'Record odometer · ' + fixtureVehicleProfile.licensePlate,
          }),
        ).toBeNull(),
      { timeout: 10000 },
    );
    await waitFor(() => expect(body.getByText('Odometer reading recorded.')).toBeVisible(), {
      timeout: 10000,
    });
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminVehicleProfile: 'network' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(within(canvasElement).getByText(/fixture-AdminVehicleProfile/)).toBeVisible(),
      { timeout: 10000 },
    );
  },
};
export const NotFound: Story = {
  name: 'Not found',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminVehicleProfile: 'not-found' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(within(canvasElement).getByText('Vehicle not found')).toBeVisible(),
      { timeout: 10000 },
    );
  },
};
