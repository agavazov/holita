import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureAlert } from '../../../../storybook/alerts-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { AlertDetailPage } from './alert-detail-page';
const meta: Meta = {
  title: 'Admin/Monitoring/Alerts',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/alerts`;
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, AlertDetailPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
};
export const Resolve: Story = {
  render: routed(`/${fixtureAlert.id}?keep=storybook#alerts`),
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminAlerts: 'network' } } } satisfies StoryFixtures,
  },
};
