import type { Meta, StoryObj } from '@storybook/angular-vite';
import { userEvent, within } from 'storybook/test';
import { AdminKarmaEdataDocument } from '../../../../../generated/graphql/operations';
import { graphqlFixture } from '../../../../../storybook/graphql-fixtures';
import {
  fixtureKarmaEdataMessage,
  fixtureKarmaMeasurementMessages,
} from '../../../../../storybook/karma-fixtures';
import { StoryApp, type StoryFixtures } from '../../../../../storybook/story-config';
import { AdminWorkspace } from '../../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Measurements',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
function routed(language = 'en'): NonNullable<Story['render']> {
  return () => ({
    props: {
      url: `/${language}/karma-client/cars/41/edata?from=2026-01-01T09:00:00&to=2026-01-01T10:00:00&size=100&listQ=KARMA&day=2026-01-01#record-context`,
    },
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}
function sourceRows(rows = fixtureKarmaMeasurementMessages, hasMore = false) {
  graphqlFixture(AdminKarmaEdataDocument, () => ({
    karmaEdata: {
      __typename: 'KarmaEdataPage',
      items: [...rows],
      hasMore,
      cursor: null,
      nextCursor: hasMore ? 'synthetic-continuation' : null,
    },
  }));
}
function restore() {
  sourceRows([fixtureKarmaEdataMessage]);
}
const openMeasurements: Story['play'] = async ({ canvasElement }) => {
  await userEvent.click(
    await within(canvasElement).findByRole(
      'button',
      { name: /^(Measurements|Измервания)$/ },
      { timeout: 10000 },
    ),
  );
};
export const Loaded: Story = {
  render: routed(),
  play: openMeasurements,
  beforeEach: () => {
    sourceRows();
    return restore;
  },
};
export const LoadedSubset: Story = {
  ...Loaded,
  beforeEach: () => {
    sourceRows(fixtureKarmaMeasurementMessages, true);
    return restore;
  },
};
export const Empty: Story = {
  ...Loaded,
  beforeEach: () => {
    sourceRows([]);
    return restore;
  },
};
export const ErrorState: Story = {
  render: routed(),
  play: openMeasurements,
  parameters: {
    holita: { scenario: { failures: { AdminKarmaEdata: 'network' } } } satisfies StoryFixtures,
  },
};
export const Loading: Story = {
  render: routed(),
  play: openMeasurements,
  parameters: {
    holita: { scenario: { failures: { AdminKarmaEdata: 'pending' } } } satisfies StoryFixtures,
  },
};
export const Bulgarian: Story = { ...Loaded, render: routed('bg') };
export const Mobile: Story = {
  ...Bulgarian,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { ...Loaded, globals: { theme: 'dark' } };
