import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../../storybook/control-center-fixtures';
import '../../../../storybook/devices-fixtures';
import '../../../../storybook/drivers-fixtures';
import '../../../../storybook/maintenance-fixtures';
import { overviewFixtures } from '../../../../storybook/overview-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import '../../../../storybook/trips-fixtures';
import '../../../../storybook/vehicle-profile-fixtures';
import '../../../../storybook/vehicles-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { DashboardWorkspace } from '../../../workspace/dashboard-workspace';
import { OverviewPage } from './overview-page';

const meta: Meta = {
  title: 'Admin/Dashboard/Overview',
  tags: ['!autodocs'],
  parameters: { discocan: { signedIn: true } satisfies StoryFixtures },
  beforeEach: () => overviewFixtures(),
};
export default meta;
type Story = StoryObj;
const route = routeAt(`${defaultBranchId}/fleet/dashboard/overview`);
const render: NonNullable<Story['render']> = () => ({
  ...route(),
  moduleMetadata: { imports: [StoryApp, AdminWorkspace, DashboardWorkspace, OverviewPage] },
  template: '<discocan-story-app [url]="url" />',
});

export const Default: Story = { render };
export const ManyTrucks: Story = {
  name: 'Many trucks',
  render,
  beforeEach: () => overviewFixtures({ manyTrucks: true }),
};
export const NoPositions: Story = {
  name: 'No positions',
  render,
  beforeEach: () => overviewFixtures({ noPositions: true }),
};
export const Loading: Story = {
  render,
  parameters: {
    discocan: {
      scenario: { failures: { AdminFleetOverview: 'pending', AdminOverviewMap: 'pending' } },
    } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render,
  parameters: {
    discocan: {
      scenario: { failures: { AdminFleetOverview: 'network', AdminOverviewMap: 'network' } },
    } satisfies StoryFixtures,
  },
};
export const Dark: Story = { render, globals: { theme: 'dark' } };
export const Narrow: Story = {
  render,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
