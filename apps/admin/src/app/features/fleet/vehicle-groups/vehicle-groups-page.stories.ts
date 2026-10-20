import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { fixtureVehicleGroups } from '../../../../storybook/vehicle-groups-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { VehicleGroupEditorPage } from './vehicle-group-editor-page';

const meta: Meta = {
  title: 'Admin/Settings/Vehicle groups',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/settings/groups`;
const appReady = { timeout: 10_000 };
const regional = fixtureVehicleGroups.find((group) => group.name === 'Regional');
if (!regional) {
  throw new Error('Missing Regional group fixture.');
}
const editableGroup = regional;

function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    // Compile the real lazy component graph before play on a cold Vite server.
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, VehicleGroupEditorPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

async function tableReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () => expect(canvas.getByRole('button', { name: 'Edit Regional' })).toBeVisible(),
    appReady,
  );
  return canvas;
}

export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1, name: /^Vehicle groups/ })).toBeVisible();
    await expect(canvas.getByText('International', { exact: true })).toBeVisible();
  },
};

export const Edit: Story = {
  render: routed(`/${editableGroup.id}/edit?keep=storybook#groups`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: 'Edit Regional' })).toBeVisible(),
      appReady,
    );
    const drawer = within(body.getByRole('dialog', { name: 'Edit Regional' }));
    await waitFor(
      () => expect(drawer.getByRole('textbox', { name: /Name/ })).toHaveValue('Regional'),
      appReady,
    );
    await userEvent.type(
      drawer.getByRole('textbox', { name: 'Description' }),
      'Saved through the real group editor.',
    );
    await userEvent.click(drawer.getByRole('button', { name: /^Save$/ }));
    await waitFor(
      () => expect(body.queryByRole('dialog', { name: 'Edit Regional' })).toBeNull(),
      appReady,
    );
    await waitFor(() => expect(body.getByText('Regional was saved.')).toBeVisible(), appReady);
    await tableReady(canvasElement);
  },
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminVehicleGroupsList: 'network' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('alert')).toHaveTextContent('fixture-AdminVehicleGroupsList'),
      appReady,
    );
  },
};

export const ProtectedDelete: Story = {
  name: 'Concurrent protected deletion',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminDeleteVehicleGroup: 'conflict' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = await tableReady(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Regional' }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const body = within(canvasElement.ownerDocument.body);
    const confirmation = await body.findByRole('alertdialog', { name: 'Delete groups?' });
    await userEvent.click(within(confirmation).getByRole('button', { name: /^Delete$/ }));
    await waitFor(
      () => expect(body.getByText(/The record changed meanwhile/)).toBeVisible(),
      appReady,
    );
    await expect(canvas.getByRole('button', { name: 'Edit Regional' })).toBeVisible();
  },
};
