import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
export const Default: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('link', { name: 'KARMA TEST 41' })).toBeVisible(), {
      timeout: 10000,
    });
    await expect(canvas.getByRole('status')).toHaveTextContent('Total: 61');
  },
};
export const SearchAndPaging: Story = {
  render: routed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('link', { name: 'KARMA TEST 41' })).toBeVisible(), {
      timeout: 10000,
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(canvas.getByRole('link', { name: 'KARMA TEST 91' })).toBeVisible());
    await userEvent.type(
      canvas.getByLabelText('Search by registration, car ID or device ID'),
      '000123456789012',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent('Matching records: 1'),
    );
    await expect(canvas.getByRole('link', { name: 'KARMA TEST 41' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent('Matching records: 61'),
    );
  },
};
const listReady: NonNullable<Story['play']> = async ({ canvasElement }) => {
  await waitFor(
    () => expect(within(canvasElement).getByRole('link', { name: 'KARMA TEST 41' })).toBeVisible(),
    { timeout: 10000 },
  );
};
export const Project: Story = { render: routed('?project=12&size=25'), play: listReady };
export const NoResults: Story = {
  render: routed('?q=missing'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByRole('cell', {
            name: 'No trucks match the selected filters.',
          }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
  },
};
export const Empty: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(AdminKarmaCarsDocument, () => ({ karmaCars: [] }));
    return () => {
      graphqlFixture(AdminKarmaCarsDocument, () => ({ karmaCars: fixtureKarmaCars }));
    };
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByRole('cell', { name: 'No trucks available in Karma.' }),
        ).toBeVisible(),
      { timeout: 10000 },
    );
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
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Karma is unavailable'),
      { timeout: 10000 },
    );
  },
};
export const Mobile: Story = {
  render: routed('?project=12&size=25'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: listReady,
};
export const Dark: Story = {
  render: routed('?size=25'),
  globals: { theme: 'dark' },
  play: listReady,
};
