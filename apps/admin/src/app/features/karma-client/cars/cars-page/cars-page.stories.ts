import type { Meta, StoryObj } from '@storybook/angular-vite';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../../storybook/story-config';
import { AdminWorkspace } from '../../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../../karma-workspace';
import { CarsPage } from './cars-page';
import { AdminKarmaCarsDocument } from '../../../../../generated/graphql/operations';
import { graphqlFixture } from '../../../../../storybook/graphql-fixtures';
import { fixtureKarmaCars } from '../../../../../storybook/karma-fixtures';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
function routed(query = ''): NonNullable<Story['render']> {
  const render = routeAt('karma-client/cars' + query);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace, CarsPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = { render: routed() };
export const SearchAndPaging: Story = { render: routed('?q=000123456789012') };
export const Project: Story = { render: routed('?project=12&size=25') };
export const NoResults: Story = { render: routed('?q=missing') };
export const Empty: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(AdminKarmaCarsDocument, () => ({ karmaCars: [] }));
    return () => { graphqlFixture(AdminKarmaCarsDocument, () => ({ karmaCars: fixtureKarmaCars })); };
  },
};
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminKarmaCars: 'pending' } } } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminKarmaCars: 'network' } } } satisfies StoryFixtures,
  },
};
export const Mobile: Story = {
  render: routed('?project=12&size=25'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { render: routed('?size=25'), globals: { theme: 'dark' } };
