import type { Meta, StoryObj } from '@storybook/angular-vite';
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
};
export const Loading: Story = {
  render,
  parameters: {
    holita: { scenario: { failures: { AdminFleetOverview: 'pending' } } } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render,
  parameters: {
    holita: { scenario: { failures: { AdminFleetOverview: 'network' } } } satisfies StoryFixtures,
  },
};
