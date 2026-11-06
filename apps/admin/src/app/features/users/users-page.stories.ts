import type { Meta, StoryObj } from '@storybook/angular-vite';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import '../../../storybook/users-fixtures';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { UserEditorPage } from './user-editor-page';
import { UsersPage } from './users-page';

const meta: Meta = {
  title: 'Admin/Settings/Users',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(suffix = ''): NonNullable<Story['render']> {
  const render = routeAt(`settings/users${suffix}`);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, UsersPage, UserEditorPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };

export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminUsers: 'pending' } } } satisfies StoryFixtures,
  },
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminUsers: 'network' } } } satisfies StoryFixtures,
  },
};

export const Create: Story = { render: routed('/new?keep=storybook#users') };

export const Edit: Story = {
  render: routed('/31000000-0000-4000-8000-000000000002/edit?keep=storybook#users'),
};

export const MissingUser: Story = { render: routed('/31000000-0000-4000-8000-000000000099/edit') };

export const PreferencesError: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminFleetPreferences: 'network' } },
    } satisfies StoryFixtures,
  },
};

export const SaveError: Story = {
  render: routed('/31000000-0000-4000-8000-000000000002/edit'),
  parameters: {
    holita: { scenario: { failures: { AdminUpdateUser: 'network' } } } satisfies StoryFixtures,
  },
};
