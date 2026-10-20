import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { fixtureOpenTrip, fixtureTrip } from '../../../../storybook/trips-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { TripDetailPage } from './trip-detail-page';
const meta: Meta = {
  title: 'Admin/Monitoring/Trips',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/trips`;
const appReady = { timeout: 10_000 };
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    // Compile the real lazy graph before play begins on a cold Vite server.
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, TripDetailPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('button', { name: /^Open trip CB 1001 AX,/ })).toBeVisible(),
      appReady,
    );
    await expect(canvas.getByRole('heading', { level: 1, name: /^Trips/ })).toBeVisible();
    await expect(canvas.getByText('Elena Petrova')).toBeVisible();
    await expect(canvas.getByText('2 events', { exact: true })).toBeVisible();
  },
};
export const Detail: Story = {
  render: routed(`/${fixtureTrip.id}?keep=storybook#trips`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: 'Trip CB 1001 AX' })).toBeVisible(),
      appReady,
    );
    const drawer = within(body.getByRole('dialog', { name: 'Trip CB 1001 AX' }));
    await waitFor(
      () => expect(drawer.getByText('Hard braking near the exit.')).toBeVisible(),
      appReady,
    );
    await expect(drawer.getByText('A sharp turn was recorded.')).toBeVisible();
    await expect(drawer.getByText('Harsh braking', { exact: true })).toBeVisible();
    await expect(drawer.getByText('Sharp turn', { exact: true })).toBeVisible();
  },
};
export const InProgress: Story = {
  name: 'In progress',
  render: routed(`/${fixtureOpenTrip.id}`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: 'Trip CB 1001 AX' })).toBeVisible(),
      appReady,
    );
    const drawer = within(body.getByRole('dialog', { name: 'Trip CB 1001 AX' }));
    await expect(drawer.getByText('In progress', { exact: true })).toBeVisible();
    await expect(drawer.queryByText(/^Arrived/)).toBeNull();
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminTrips: 'network' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('alert')).toHaveTextContent('fixture-AdminTrips'),
      appReady,
    );
  },
};
