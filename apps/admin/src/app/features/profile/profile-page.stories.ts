import type { Meta, StoryObj } from '@storybook/angular-vite';
import { fixtureProfile } from '../../../storybook/profile-fixtures';
import {
  routeAt,
  StoryApp,
  storyLanguage,
  type StoryFixtures,
} from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { profileText } from './i18n/messages';
import { ProfilePage } from './profile-page';
import { ProfileView } from './profile-view';

const meta: Meta = {
  title: 'Admin/Profile',
  tags: ['!autodocs'],
  parameters: { discocan: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(): NonNullable<Story['render']> {
  const render = routeAt('profile');
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, ProfilePage] },
    template: '<discocan-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };

export const Loading: Story = {
  render: routed(),
  parameters: {
    discocan: { scenario: { failures: { AdminProfile: 'pending' } } } satisfies StoryFixtures,
  },
};

export const LoadError: Story = {
  render: routed(),
  parameters: {
    discocan: { scenario: { failures: { AdminProfile: 'network' } } } satisfies StoryFixtures,
  },
};

export const SaveError: Story = {
  render: (_args, context) => {
    const text = profileText(storyLanguage(context.globals));
    return {
      props: {
        user: fixtureProfile,
        error: text.saveError,
        fieldErrors: { email: text.duplicateEmail },
      },
      moduleMetadata: { imports: [ProfileView] },
      template:
        '<discocan-profile-view [user]="user" [saveError]="error" [fieldErrors]="fieldErrors" />',
    };
  },
};

export const PasswordError: Story = {
  render: (_args, context) => {
    const text = profileText(storyLanguage(context.globals));
    return {
      props: {
        user: fixtureProfile,
        error: text.passwordError,
        fieldErrors: { currentPassword: text.incorrectPassword },
      },
      moduleMetadata: { imports: [ProfileView] },
      template:
        '<discocan-profile-view [user]="user" [passwordError]="error" [passwordFieldErrors]="fieldErrors" />',
    };
  },
};

export const SavingDetails: Story = {
  render: () => ({
    props: { user: fixtureProfile },
    moduleMetadata: { imports: [ProfileView] },
    template: '<discocan-profile-view [user]="user" [saving]="true" />',
  }),
};

export const ChangingPassword: Story = {
  render: () => ({
    props: { user: fixtureProfile },
    moduleMetadata: { imports: [ProfileView] },
    template: '<discocan-profile-view [user]="user" [changingPassword]="true" />',
  }),
};

export const Saved: Story = {
  render: () => ({
    props: { user: fixtureProfile },
    moduleMetadata: { imports: [ProfileView] },
    template: '<discocan-profile-view [user]="user" [saved]="true" />',
  }),
};
