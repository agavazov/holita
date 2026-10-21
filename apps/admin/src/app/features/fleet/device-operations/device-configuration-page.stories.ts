import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { configurationStoryDevices } from '../../../../storybook/device-configuration-fixtures';
import { enterNumber } from '../../../../storybook/interactions';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { DeviceConfigurationPage } from './device-configuration-page';

const meta: Meta = {
  title: 'Admin/Fleet/Device configuration',
  tags: ['!autodocs'],
  parameters: {
    throwPlayFunctionExceptions: true,
    holita: { signedIn: true } satisfies StoryFixtures,
  },
};
export default meta;
type Story = StoryObj;

function routed(
  deviceId: string = configurationStoryDevices.confirmed,
): NonNullable<Story['render']> {
  const render = routeAt(`${defaultBranchId}/fleet/devices/${deviceId}/configuration`);
  return () => ({
    ...render(),
    moduleMetadata: {
      imports: [StoryApp, AdminWorkspace, FleetWorkspace, DeviceConfigurationPage],
    },
    template: '<holita-story-app [url]="url" />',
  });
}

async function ready(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () =>
      expect(canvas.getByRole('heading', { level: 1, name: 'Device configuration' })).toBeVisible(),
    { timeout: 10000 },
  );
  await waitFor(
    () =>
      expect(
        canvas.getByRole('heading', { level: 2, name: 'Selected Fleet device' }),
      ).toBeVisible(),
    { timeout: 10000 },
  );
  return canvas;
}

async function selectWriteTarget(canvasElement: HTMLElement) {
  const canvas = await ready(canvasElement);
  const target = canvas.getByRole('combobox', { name: /Karma truck/ });
  await waitFor(() => expect(target).not.toHaveAttribute('aria-disabled', 'true'), {
    timeout: 10000,
  });
  await userEvent.click(target);
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(
    await body.findByRole('option', { name: 'KARMA TEST 41 · 41 · 000123456789012' }),
  );
  await waitFor(() => expect(body.queryByRole('listbox')).not.toBeInTheDocument(), {
    timeout: 10000,
  });
  return {
    canvas,
    body,
    editor: within(canvas.getByRole('region', { name: 'Change eData parameters' })),
  };
}

async function prepareInterval(canvasElement: HTMLElement) {
  const context = await selectWriteTarget(canvasElement);
  await userEvent.click(context.editor.getByRole('combobox', { name: 'Change type' }));
  await userEvent.click(
    await context.body.findByRole('option', { name: 'Change an existing interval' }),
  );
  await userEvent.click(context.editor.getByRole('combobox', { name: /Existing parameter ID/ }));
  await userEvent.click(await context.body.findByRole('option', { name: '65000' }));
  await enterNumber(context.editor.getByRole('spinbutton', { name: /New reporting interval/ }), 60);
  return context;
}

async function prepareAddition(canvasElement: HTMLElement, interval: number) {
  const context = await selectWriteTarget(canvasElement);
  await userEvent.click(context.editor.getByRole('combobox', { name: /Catalog parameter/ }));
  await userEvent.click(
    await context.body.findByRole('option', { name: '1001 · Fixture preset 1001 · Monitor 9.56' }),
  );
  await enterNumber(
    context.editor.getByRole('spinbutton', { name: /New reporting interval/ }),
    interval,
  );
  return context;
}

export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.getByText('FDE8' + '00'.repeat(20))).not.toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Read selected device settings' }),
    ).toBeDisabled();
  },
};

export const RequestRead: Story = {
  name: 'Request a background read',
  render: routed(configurationStoryDevices.empty),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    const select = canvas.getByRole('combobox', { name: /Karma truck/ });
    await waitFor(() => expect(select).not.toHaveAttribute('aria-disabled', 'true'), {
      timeout: 10000,
    });
    await userEvent.click(select);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByRole('option', { name: 'KARMA TEST 41 · 41 · 000123456789012' }),
    );
    await waitFor(() => expect(body.queryByRole('listbox')).not.toBeInTheDocument(), {
      timeout: 10000,
    });
    const read = canvas.getByRole('button', { name: 'Read selected device settings' });
    await expect(read).toBeDisabled();
    await userEvent.click(
      canvas.getByRole('checkbox', {
        name: 'Read from this selected Karma truck for the Fleet device shown above.',
      }),
    );
    await expect(read).toBeEnabled();
    await userEvent.click(read);
    await waitFor(
      () =>
        expect(
          body.getByText('The read request was saved. The server is waiting for the device.'),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(
      canvas.getByText(
        'The server saves the request and waits for the device. You can leave this page or refresh it while the read continues.',
      ),
    ).toBeVisible();
  },
};

export const Waiting: Story = {
  name: 'Waiting with previous snapshot',
  render: routed(configurationStoryDevices.waiting),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByText('Waiting for device', { exact: true })).toBeVisible();
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Read selected device settings' }),
    ).toBeDisabled();
  },
};

export const Unknown: Story = {
  name: 'Uncertain submission',
  render: routed(configurationStoryDevices.unknown),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(
      canvas.getByText('Submission uncertain; checking for response', { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Read selected device settings' }),
    ).toBeDisabled();
  },
};

export const TimedOut: Story = {
  name: 'Timed out with previous snapshot',
  render: routed(configurationStoryDevices.timedOut),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(
      canvas.getByText('No complete response before the deadline', { exact: true }),
    ).toBeVisible();
    await expect(canvas.getByRole('table')).toBeVisible();
  },
};

export const Empty: Story = {
  render: routed(configurationStoryDevices.empty),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByText('No saved device operations', { exact: true })).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

export const EmptyConfiguration: Story = {
  name: 'Confirmed empty parameter set',
  render: routed(configurationStoryDevices.emptyConfiguration),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(
      canvas.getByText('The device returned a complete empty parameter configuration.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(canvas.getByText('Configuration confirmed', { exact: true })).toBeVisible();
  },
};

export const Disabled: Story = {
  render: routed(configurationStoryDevices.disabled),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await waitFor(
      () =>
        expect(
          canvas.getByText(
            'Background device reads are disabled on the server. Previously saved requests and results remain available.',
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.queryByRole('combobox')).toBeNull();
  },
};

export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: {
      signedIn: true,
      scenario: { failures: { AdminDeviceConfigurationPage: 'pending' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByText('Loading saved requests and settings…'),
        ).toBeVisible(),
      { timeout: 10000 },
    );
  },
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: {
      signedIn: true,
      scenario: { failures: { AdminDeviceConfigurationPage: 'network' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(
          canvas.getByText('Device configuration could not be loaded.', { exact: true }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
  },
};

export const TargetsError: Story = {
  name: 'Karma target error',
  render: routed(),
  parameters: {
    holita: {
      signedIn: true,
      scenario: { failures: { AdminDeviceConfigurationTargets: 'network' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByRole('table')).toBeVisible();
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible(), {
      timeout: 10000,
    });
    await expect(
      canvas.getByRole('button', { name: 'Read selected device settings' }),
    ).toBeDisabled();
  },
};

export const MobileDark: Story = {
  name: 'Mobile dark',
  render: routed(configurationStoryDevices.waiting),
  globals: { viewport: { value: 'mobile375', isRotated: false }, theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByText('Waiting for device', { exact: true })).toBeVisible();
    await expect(canvas.getByRole('table')).toBeVisible();
  },
};

export const AddParameter: Story = {
  name: 'Add a catalog parameter',
  render: routed(),
  play: async ({ canvasElement }) => {
    const { editor, body } = await prepareAddition(canvasElement, 60);
    await userEvent.click(editor.getByRole('checkbox', { name: /Send this exact change/ }));
    await expect(editor.getByRole('checkbox', { name: /Send this exact change/ })).toBeChecked();
    await userEvent.click(editor.getByRole('button', { name: 'Save background change' }));
    await waitFor(
      () =>
        expect(
          body.getByText(
            'The parameter change was saved. The server will check, send and verify it in the background.',
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
  },
};

export const EditUnknownInterval: Story = {
  name: 'Edit an unknown parameter interval',
  render: routed(),
  play: async ({ canvasElement }) => {
    const { editor, body } = await prepareInterval(canvasElement);
    await userEvent.click(editor.getByText('Technical change details', { exact: true }));
    await expect(editor.getByText('FDE8' + '00'.repeat(20))).toBeVisible();
    await userEvent.click(editor.getByRole('checkbox', { name: /Send this exact change/ }));
    await userEvent.click(editor.getByRole('button', { name: 'Save background change' }));
    await waitFor(
      () =>
        expect(
          body.getByText(
            'The parameter change was saved. The server will check, send and verify it in the background.',
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
  },
};

export const InvalidIntervalFocus: Story = {
  name: 'Interval validation focuses the field',
  render: routed(),
  play: async ({ canvasElement }) => {
    const { editor } = await prepareInterval(canvasElement);
    const interval = editor.getByRole('spinbutton', { name: /New reporting interval/ });
    await userEvent.clear(interval);
    await userEvent.click(editor.getByRole('button', { name: 'Save background change' }));
    await waitFor(() => expect(interval).toHaveFocus(), { timeout: 10000 });
    await expect(interval).toHaveAttribute('aria-invalid', 'true');
  },
};

export const WriteFailure: Story = {
  name: 'Rejected write keeps its draft',
  render: routed(),
  parameters: {
    holita: {
      signedIn: true,
      scenario: { failures: { AdminRequestDeviceParameterIntervalUpdate: 'network' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const { editor } = await prepareInterval(canvasElement);
    await userEvent.click(editor.getByRole('checkbox', { name: /Send this exact change/ }));
    await userEvent.click(editor.getByRole('button', { name: 'Save background change' }));
    await waitFor(
      () =>
        expect(
          editor.getByText(
            'The parameter change could not be confirmed as saved. Check refreshed saved operations before submitting again.',
            { exact: false },
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(editor.getByRole('spinbutton', { name: /New reporting interval/ })).toHaveValue(
      '60',
    );
  },
};

export const WriteWaiting: Story = {
  name: 'Background write verification',
  render: routed(configurationStoryDevices.writeWaiting),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByText('Update interval', { exact: true })).toBeVisible();
    await expect(
      canvas.getByText('Verifying complete configuration', { exact: true }),
    ).toBeVisible();
    await expect(canvas.getByRole('table')).toBeVisible();
  },
};

export const WriteUncertain: Story = {
  name: 'Uncertain write is not repeated',
  render: routed(configurationStoryDevices.writeUncertain),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await waitFor(
      () =>
        expect(
          canvas.getByText(
            'The device may have received this change. The server checks readback and does not automatically resend an uncertain write.',
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
  },
};

export const EditMobileDark: Story = {
  name: 'Parameter draft mobile dark',
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false }, theme: 'dark' },
  play: async ({ canvasElement }) => {
    const { editor } = await prepareInterval(canvasElement);
    await expect(editor.getByText('Requested change preview')).toBeVisible();
  },
};

export const ZeroIntervalConfirmation: Story = {
  name: 'Zero interval and confirmation of the exact change',
  render: routed(),
  play: async ({ canvasElement }) => {
    const { editor } = await prepareAddition(canvasElement, 60);
    const confirmed = editor.getByRole('checkbox', { name: /Send this exact change/ });
    await userEvent.click(confirmed);
    await expect(confirmed).toBeChecked();
    await enterNumber(editor.getByRole('spinbutton', { name: /New reporting interval/ }), 0);
    await expect(confirmed).not.toBeChecked();
    const zero = editor.getByRole('checkbox', {
      name: /I intend to use the special zero interval/,
    });
    await expect(zero).not.toBeChecked();
    await userEvent.click(confirmed);
    await userEvent.click(editor.getByRole('button', { name: 'Save background change' }));
    await waitFor(() => expect(zero).toHaveFocus(), { timeout: 10000 });
    await waitFor(
      () =>
        expect(
          editor.getByText('Confirm the special meaning of interval zero.', { exact: true }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await userEvent.click(zero);
    await expect(zero).toBeChecked();
    await expect(confirmed).toBeChecked();
    await waitFor(
      () =>
        expect(
          editor.queryByText('Confirm the special meaning of interval zero.', { exact: true }),
        ).toBeNull(),
      { timeout: 10000 },
    );
    await expect(editor.getByRole('spinbutton', { name: /New reporting interval/ })).toHaveValue(
      '0',
    );
  },
};

export const RowActionDraft: Story = {
  name: 'Row interval action protects its unsaved draft',
  render: routed(),
  play: async ({ canvasElement }) => {
    const { canvas, body, editor } = await selectWriteTarget(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit interval 65000' }));
    const interval = editor.getByRole('spinbutton', { name: /New reporting interval/ });
    await waitFor(() => expect(interval).toHaveValue('0'), { timeout: 10000 });
    await enterNumber(interval, 45);
    await userEvent.click(canvas.getByRole('link', { name: 'Back to devices' }));
    const dialog = await body.findByRole(
      'alertdialog',
      { name: 'Unsaved changes' },
      { timeout: 10000 },
    );
    await waitFor(() => expect(dialog).toBeVisible(), { timeout: 10000 });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(dialog).not.toBeVisible(), { timeout: 10000 });
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Device configuration' }),
    ).toBeVisible();
    await expect(interval).toHaveValue('45');
    await expect(
      editor.getByRole('checkbox', { name: /Send this exact change/ }),
    ).not.toBeChecked();
  },
};

export const SavedSnapshotSelection: Story = {
  name: 'Inspect an older snapshot and return to latest settings',
  render: routed(configurationStoryDevices.history),
  play: async ({ canvasElement }) => {
    const { canvas } = await selectWriteTarget(canvasElement);
    const older = canvas.getAllByRole('article')[1];
    if (!older) {
      throw new Error('Missing older saved operation.');
    }
    await userEvent.click(
      within(older).getByRole('button', { name: 'View this saved configuration' }),
    );
    await expect(canvas.getByRole('heading', { name: 'Saved parameter snapshot' })).toBeVisible();
    const action = canvas.getByRole('button', { name: 'Edit interval 65000' });
    const oldRow = action.closest('tr');
    if (!oldRow) {
      throw new Error('Missing historical parameter row.');
    }
    await expect(within(oldRow).getAllByRole('cell')[1]).toHaveTextContent(/^120$/);
    await expect(action).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Show latest confirmed settings' }));
    await expect(
      canvas.getByRole('heading', { name: 'Last confirmed parameter snapshot' }),
    ).toBeVisible();
    const latestAction = canvas.getByRole('button', { name: 'Edit interval 65000' });
    const latestRow = latestAction.closest('tr');
    if (!latestRow) {
      throw new Error('Missing latest parameter row.');
    }
    await expect(within(latestRow).getAllByRole('cell')[1]).toHaveTextContent(/^0$/);
    await expect(latestAction).toBeEnabled();
  },
};

export const WritesDisabled: Story = {
  name: 'Read access with parameter writes disabled',
  render: routed(configurationStoryDevices.writesDisabled),
  play: async ({ canvasElement }) => {
    const { canvas, editor } = await selectWriteTarget(canvasElement);
    await waitFor(
      () =>
        expect(
          editor.getByText(
            'Parameter changes are disabled on the server. Saved operations remain available.',
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: /Karma truck/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(editor.queryByRole('button', { name: 'Save background change' })).toBeNull();
  },
};

export const BaselineRequired: Story = {
  name: 'Read a complete baseline before preparing a change',
  render: routed(configurationStoryDevices.empty),
  play: async ({ canvasElement }) => {
    const { editor } = await selectWriteTarget(canvasElement);
    await waitFor(
      () =>
        expect(
          editor.getByText(
            'Read and confirm a complete configuration for this exact Fleet device and selected Karma device before changing parameters.',
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(editor.getByRole('button', { name: 'Save background change' })).toBeDisabled();
  },
};

export const SavedWriteFailure: Story = {
  name: 'Saved write rejected before sending',
  render: routed(configurationStoryDevices.writeFailed),
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByText('Operation failed', { exact: true })).toBeVisible();
    await expect(canvas.getByText('BASELINE_CHANGED', { exact: true })).toBeVisible();
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: 'Last confirmed parameter snapshot' }),
    ).toBeVisible();
  },
};
