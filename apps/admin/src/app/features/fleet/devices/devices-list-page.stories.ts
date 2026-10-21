import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { fixtureDevice } from '../../../../storybook/devices-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { DevicesPage } from './devices-list-page';
import { DeviceEditorPage } from './device-editor-page';
import { DeviceDiagnosticsPage } from './device-diagnostics-page';

const meta: Meta = {
  title: 'Admin/Fleet/Devices',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = defaultBranchId + '/fleet/devices';
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [
        StoryApp,
        AdminWorkspace,
        FleetWorkspace,
        DevicesPage,
        DeviceEditorPage,
        DeviceDiagnosticsPage,
      ],
    },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(
          canvas.getByRole('button', { name: 'Open device ' + fixtureDevice.imei }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(canvas.getByText('STARLINK_TRACKER')).toBeVisible();
    await expect(canvas.getByText('Demo · firmware policy unavailable')).toBeVisible();
  },
};
export const Edit: Story = {
  render: routed('/' + fixtureDevice.id + '/edit'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () =>
        expect(body.getByRole('dialog', { name: 'Device ' + fixtureDevice.imei })).toBeVisible(),
      { timeout: 10000 },
    );
    const drawer = within(body.getByRole('dialog', { name: 'Device ' + fixtureDevice.imei }));
    await waitFor(
      () => expect(drawer.getByRole('textbox', { name: /^IMEI/ })).toHaveValue(fixtureDevice.imei),
      { timeout: 10000 },
    );
    await expect(drawer.getByRole('textbox', { name: 'Firmware' })).toHaveValue('2.26.1');
    await userEvent.clear(drawer.getByRole('textbox', { name: 'Notes' }));
    await userEvent.type(
      drawer.getByRole('textbox', { name: 'Notes' }),
      'Saved through the real Devices adapter.',
    );
    await userEvent.click(drawer.getByRole('button', { name: 'Save' }));
    await waitFor(
      () => expect(body.queryByRole('dialog', { name: 'Device ' + fixtureDevice.imei })).toBeNull(),
      { timeout: 10000 },
    );
  },
};
export const Stock: Story = {
  render: routed('/new'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: 'Register device' })).toBeVisible(),
      { timeout: 10000 },
    );
    const drawer = within(body.getByRole('dialog', { name: 'Register device' }));
    await userEvent.type(drawer.getByRole('textbox', { name: /^IMEI/ }), '000000000000123');
    await userEvent.click(drawer.getByRole('button', { name: 'Register' }));
    await waitFor(
      () => expect(body.queryByRole('dialog', { name: 'Register device' })).toBeNull(),
      { timeout: 10000 },
    );
  },
};
export const Diagnostics: Story = {
  render: routed('/' + fixtureDevice.id + '/diagnostics'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('dialog', { name: 'Diagnostics' })).toBeVisible(), {
      timeout: 10000,
    });
    const drawer = within(body.getByRole('dialog', { name: 'Diagnostics' }));
    await waitFor(() => expect(drawer.getByText('STARLINK_TRACKER')).toBeVisible(), {
      timeout: 10000,
    });
    await expect(drawer.getAllByText('Unavailable', { exact: true })).toHaveLength(2);
  },
};
export const ViewThenEdit: Story = {
  name: 'Open Diagnostics before editing and return',
  render: routed('?keep=devices#devices'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () =>
        expect(
          canvas.getByRole('button', { name: 'Open device ' + fixtureDevice.imei }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Open device ' + fixtureDevice.imei }),
    );
    await waitFor(() => expect(body.getByRole('dialog', { name: 'Diagnostics' })).toBeVisible(), {
      timeout: 10000,
    });
    await waitFor(
      () =>
        expect(
          within(body.getByRole('dialog', { name: 'Diagnostics' })).getByRole('button', {
            name: 'Edit',
          }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(
      within(body.getByRole('dialog', { name: 'Diagnostics' })).queryByRole('textbox'),
    ).toBeNull();
    await userEvent.click(
      within(body.getByRole('dialog', { name: 'Diagnostics' })).getByRole('button', {
        name: 'Edit',
      }),
    );
    const title = 'Device ' + fixtureDevice.imei;
    await waitFor(() => expect(body.getByRole('dialog', { name: title })).toBeVisible(), {
      timeout: 10000,
    });
    await waitFor(
      () =>
        expect(
          within(body.getByRole('dialog', { name: title })).getByRole('textbox', { name: 'Notes' }),
        ).toHaveValue(fixtureDevice.notes),
      { timeout: 10000 },
    );
    await userEvent.type(
      within(body.getByRole('dialog', { name: title })).getByRole('textbox', { name: 'Notes' }),
      ' Unsaved',
    );
    await userEvent.click(
      within(body.getByRole('dialog', { name: title })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    const confirmation = await body.findByRole('alertdialog', { name: 'Unsaved changes' });
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(body.getByRole('dialog', { name: 'Diagnostics' })).toBeVisible(), {
      timeout: 10000,
    });
    await waitFor(
      () =>
        expect(
          within(body.getByRole('dialog', { name: 'Diagnostics' })).getByRole('button', {
            name: 'Edit',
          }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await userEvent.click(
      within(body.getByRole('dialog', { name: 'Diagnostics' })).getByRole('button', {
        name: 'Edit',
      }),
    );
    await waitFor(() => expect(body.getByRole('dialog', { name: title })).toBeVisible(), {
      timeout: 10000,
    });
    await waitFor(
      () =>
        expect(
          within(body.getByRole('dialog', { name: title })).getByRole('textbox', { name: 'Notes' }),
        ).toHaveValue(fixtureDevice.notes),
      { timeout: 10000 },
    );
    await userEvent.click(
      within(body.getByRole('dialog', { name: title })).getByRole('button', {
        name: 'Save',
      }),
    );
    await waitFor(() => expect(body.getByRole('dialog', { name: 'Diagnostics' })).toBeVisible(), {
      timeout: 10000,
    });
  },
};
export const ErrorState: Story = {
  name: 'Error',
  parameters: {
    holita: { scenario: { failures: { AdminDevices: 'network' } } } satisfies StoryFixtures,
  },
  render: routed(),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(within(canvasElement).getByRole('alert')).toHaveTextContent('fixture-AdminDevices'),
      { timeout: 10000 },
    );
  },
};
