import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../storybook/control-center-fixtures';
import '../../../storybook/dashboard-problems-fixtures';
import { defaultBranchId } from '../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { DashboardWorkspace } from '../../workspace/dashboard-workspace';
import { AlertDetailPage } from '../fleet/alerts/alert-detail-page';
import { ProblemsPage } from '../fleet/overview/problems-page';

const meta: Meta = {
  title: 'Admin/Dashboard/Problems',
  tags: ['!autodocs'],
  parameters: { discocan: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const route = routeAt(`${defaultBranchId}/fleet/dashboard/problems`);

export const CombinedFeed: Story = {
  name: 'Combined feed',
  render: () => ({
    ...route(),
    moduleMetadata: {
      imports: [StoryApp, AdminWorkspace, DashboardWorkspace, ProblemsPage, AlertDetailPage],
    },
    template: '<discocan-story-app [url]="url" />',
  }),
};
