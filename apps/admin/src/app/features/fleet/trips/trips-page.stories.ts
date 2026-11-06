import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import {
  fixtureOpenTrip,
  fixtureTrip,
  tripsNoResultsSearch,
} from '../../../../storybook/trips-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { TripDetailPage } from './trip-detail-page';
const meta: Meta = {
  title: 'Admin/Dashboard/Trips',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/dashboard/trips`;
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, TripDetailPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
};
export const Detail: Story = {
  render: routed(`/${fixtureTrip.id}?keep=storybook#trips`),
};
export const InProgress: Story = {
  name: 'In progress',
  render: routed(`/${fixtureOpenTrip.id}`),
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminTrips: 'network' } } } satisfies StoryFixtures,
  },
};
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminTrips: 'pending' } } } satisfies StoryFixtures,
  },
};
export const NoResults: Story = {
  render: routed(`?search=${tripsNoResultsSearch}`),
};
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
