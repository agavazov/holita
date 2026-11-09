import type { Meta, StoryObj } from '@storybook/angular-vite';
import {
  fixtureServiceReceipt,
  fixtureServiceTask,
} from '../../../../storybook/maintenance-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { MaintenanceRecordPage } from './maintenance-record-page';
const meta: Meta = {
  title: 'Admin/Fleet/Maintenance',
  tags: ['!autodocs'],
  parameters: { discocan: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/maintenance`;
function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, MaintenanceRecordPage] },
    template: '<discocan-story-app [url]="url" />',
  });
}
export const Default: Story = {
  render: routed(),
};
export const FirstLoad: Story = {
  name: 'First load',
  render: routed(),
  parameters: {
    discocan: { scenario: { latencyMs: 1800 } } satisfies StoryFixtures,
  },
};
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Edit: Story = {
  render: routed(`/${fixtureServiceTask.id}/edit?keep=storybook#maintenance`),
};
export const CompleteAndPlan: Story = {
  name: 'Complete and plan next',
  render: routed(`/${fixtureServiceTask.id}/complete`),
};
export const CompletedReceipt: Story = {
  name: 'Completed receipt',
  render: routed(`/${fixtureServiceReceipt.id}`),
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    discocan: { scenario: { failures: { AdminServiceTasks: 'network' } } } satisfies StoryFixtures,
  },
};
