import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../storybook/control-center-fixtures';
import '../../../storybook/queue-fixtures';
import { defaultBranchId } from '../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { BranchCommandQueuePage } from './branch-command-queue-page';

const meta: Meta = {
  title: 'Admin/Command queue',
  tags: ['!autodocs'],
  parameters: {
    discocan: { signedIn: true, now: '2026-10-20T08:00:05.000Z' } satisfies StoryFixtures,
  },
};
export default meta;
type Story = StoryObj;
function routed(query = ''): NonNullable<Story['render']> {
  const render = routeAt(`${defaultBranchId}/fleet/command-queue${query}`);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, BranchCommandQueuePage] },
    template: '<discocan-story-app [url]="url" />',
  });
}
export const Default: Story = { render: routed() };
export const Waiting: Story = { render: routed('?statuses=QUEUED') };
export const Answered: Story = { render: routed('?statuses=ANSWERED') };
export const Empty: Story = { render: routed('?statuses=EXPIRED') };
export const Narrow: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  render: routed(),
};
export const ErrorState: Story = {
  name: 'Error',
  parameters: {
    discocan: {
      scenario: { failures: { AdminControlCenterBranchCommandRequests: 'network' } },
    } satisfies StoryFixtures,
  },
  render: routed(),
};
