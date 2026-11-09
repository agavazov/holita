import type { Meta, StoryObj } from '@storybook/angular-vite';
import { notificationFixtures } from '../../../storybook/notifications-fixtures';
import { defaultBranchId } from '../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { NotificationsPage } from './notifications-page';

const meta: Meta = {
  title: 'Admin/Notifications',
  tags: ['!autodocs'],
  parameters: { discocan: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(query = '', empty = false): NonNullable<Story['render']> {
  const render = routeAt(`${defaultBranchId}/fleet/notifications${query}`);
  return () => {
    notificationFixtures(empty);
    return {
      ...render(),
      moduleMetadata: { imports: [StoryApp, AdminWorkspace, NotificationsPage] },
      template: '<discocan-story-app [url]="url" />',
    };
  };
}

export const Default: Story = { render: routed() };
export const UnreadFilter: Story = { render: routed('?readState=UNREAD') };
export const Empty: Story = { render: routed('', true) };
export const Error: Story = {
  render: routed(),
  parameters: {
    discocan: { scenario: { failures: { AdminNotifications: 'network' } } } satisfies StoryFixtures,
  },
};
export const Narrow: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
