import type { Meta, StoryObj } from '@storybook/angular-vite';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../karma-workspace';
import { KarmaAdministration } from './karma-administration';

const meta: Meta = {
  title: 'Admin/Karma Client/Administration',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(section = 'users', query = ''): NonNullable<Story['render']> {
  const render = routeAt(`karma-client/administration/${section}${query}`);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace, KarmaAdministration] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Users: Story = { render: routed() };
export const Roles: Story = { render: routed('roles') };
export const Projects: Story = { render: routed('projects') };
export const TimeZones: Story = { render: routed('time-zones') };
export const ApiInformation: Story = { render: routed('api-info') };
export const Search: Story = { render: routed('users', '?q=fixture-001&size=25') };
export const NoResults: Story = { render: routed('users', '?q=missing') };
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminKarmaUsers: 'pending' } } } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminKarmaUsers: 'network' } } } satisfies StoryFixtures,
  },
};
export const Bulgarian: Story = {
  render: () => ({
    props: { url: '/bg/karma-client/administration/users' },
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace, KarmaAdministration] },
    template: '<holita-story-app [url]="url" />',
  }),
};
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { render: routed(), globals: { theme: 'dark' } };
