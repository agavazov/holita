import type { Meta, StoryObj } from '@storybook/angular-vite';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../karma-workspace';
import { KarmaAdministration } from './karma-administration';

const meta: Meta = {
  title: 'Admin/Karma Client/Administration/Users',
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

export const Default: Story = { render: routed() };
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
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
