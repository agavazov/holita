import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { fixtureFleetSettings } from '../../../../storybook/general-settings-fixtures';
import { enterNumber } from '../../../../storybook/interactions';
import { defaultBranchId, fixtureBranches } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { GeneralSettingsPage } from './general-settings-page';

const meta: Meta = {
  title: 'Admin/Settings/General',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/settings/general`;
const appReady = { timeout: 10_000 };
const branch = fixtureBranches.find((candidate) => candidate.id === defaultBranchId);
if (!branch) {
  throw new Error('Missing General settings Branch fixture.');
}
const branchName = branch.name;

function routed(): NonNullable<Story['render']> {
  const render = routeAt(path);
  return () => ({
    ...render(),
    // Prepare the real lazy component graph before play on a cold Vite server.
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, GeneralSettingsPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

async function ready(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(async () => {
    await expect(canvas.getByRole('textbox', { name: /Branch name/ })).toHaveValue(branchName);
    await expect(canvas.getByRole('spinbutton', { name: /Low fuel below/ })).toHaveAttribute(
      'aria-valuenow',
      String(fixtureFleetSettings.lowFuelPct),
    );
  }, appReady);
  const element = canvasElement.querySelector('holita-general-settings-view');
  if (!(element instanceof HTMLElement)) {
    throw new Error('Missing live General settings view.');
  }
  return within(element);
}

export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const view = await ready(canvasElement);
    await expect(view.getByRole('heading', { level: 1, name: 'General' })).toBeVisible();
    await expect(
      view.getByText(
        'Notification delivery is not connected. These options are unavailable and are not saved.',
      ),
    ).toBeVisible();
    for (const control of view.getAllByRole('switch')) {
      await expect(control).toBeDisabled();
    }
  },
};

export const Saved: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const view = await ready(canvasElement);
    const lowFuel = view.getByRole('spinbutton', { name: /Low fuel below/ });
    await enterNumber(lowFuel, 13);
    await userEvent.click(view.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => {
      await expect(
        within(canvasElement.ownerDocument.body).getByText('Settings saved.'),
      ).toBeVisible();
      await expect(view.queryByRole('region', { name: 'You have unsaved changes.' })).toBeNull();
    }, appReady);
    await expect(lowFuel).toHaveAttribute('aria-valuenow', '13');
    for (const control of view.getAllByRole('switch')) {
      await expect(control).toBeDisabled();
    }
  },
};

export const PartialRenameFailure: Story = {
  name: 'Fleet saved, Branch rename failed',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminUpdateBranchName: 'network' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const view = await ready(canvasElement);
    const name = view.getByRole('textbox', { name: /Branch name/ });
    const lowFuel = view.getByRole('spinbutton', { name: /Low fuel below/ });
    await userEvent.type(name, ' North');
    await enterNumber(lowFuel, 13);
    await userEvent.click(view.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => {
      await expect(view.getByRole('alert')).toHaveTextContent(
        'Fleet settings were saved, but the Branch name was not saved.',
      );
      await expect(name).toHaveValue(`${branchName} North`);
    }, appReady);
    await expect(
      within(canvasElement.ownerDocument.body).queryByText('Settings saved.'),
    ).toBeNull();
    await userEvent.click(view.getByRole('button', { name: 'Discard' }));
    await expect(name).toHaveValue(branchName);
    await expect(lowFuel).toHaveAttribute('aria-valuenow', '13');
    await expect(view.queryByRole('region', { name: 'You have unsaved changes.' })).toBeNull();
  },
};

export const SaveError: Story = {
  name: 'Failed Fleet save keeps the draft',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminUpdateFleetSettings: 'network' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const view = await ready(canvasElement);
    const name = view.getByRole('textbox', { name: /Branch name/ });
    await userEvent.type(name, ' North');
    await userEvent.click(view.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => {
      await expect(view.getByRole('alert')).toHaveTextContent('fixture-AdminUpdateFleetSettings');
      await expect(name).toBeEnabled();
      await expect(name).toHaveValue(`${branchName} North`);
    }, appReady);
  },
};

export const ReadError: Story = {
  name: 'Preferences read failure',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminFleetPreferences: 'network' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
        'fixture-AdminFleetPreferences',
      );
    }, appReady);
  },
};
