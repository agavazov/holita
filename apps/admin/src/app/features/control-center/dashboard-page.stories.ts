import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../storybook/control-center-fixtures';
import { defaultBranchId } from '../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { ControlCenterWorkspace } from './control-center-workspace';
import { DashboardPage } from './dashboard-page';
const meta: Meta = {
  title: 'Admin/Control center/Dashboard',
  tags: ['!autodocs'],
  parameters: {
    holita: { signedIn: true, now: '2026-10-20T08:05:00.000Z' } satisfies StoryFixtures,
  },
};
export default meta;
type Story = StoryObj;
const render = routeAt(defaultBranchId + '/control-center');
export const Default: Story = {
  render: () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, ControlCenterWorkspace, DashboardPage] },
    template: '<holita-story-app [url]="url" />',
  }),
};
