import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import '../../../../storybook/overview-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { OverviewPage } from './overview-page';

const meta: Meta = {
  title: 'Admin/Monitoring/Overview',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const route = routeAt(`${defaultBranchId}/fleet/overview`);
const render: NonNullable<Story['render']> = () => ({
  ...route(),
  moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, OverviewPage] },
  template: '<holita-story-app [url]="url" />',
});
export const Default: Story = {
  render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible(),
      { timeout: 10000 },
    );
    await waitFor(
      () => expect(canvas.getByRole('heading', { name: 'Latest trips' })).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(
      canvas.getByRole('link', { name: 'CB 1001 AX · Sofia → Plovdiv' }),
    ).toHaveAttribute(
      'href',
      `/en/${defaultBranchId}/fleet/trips/70000000-0000-4000-8000-000000000001`,
    );
    await waitFor(() => {
      const root = canvasElement.ownerDocument.documentElement;
      return expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    });
  },
};
export const Loading: Story = {
  render,
  parameters: {
    holita: { scenario: { failures: { AdminFleetOverview: 'pending' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByRole('heading', { level: 1, name: 'Overview' }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render,
  parameters: {
    holita: { scenario: { failures: { AdminFleetOverview: 'network' } } } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByText('The overview could not be loaded')).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible();
  },
};
