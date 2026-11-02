import type { Meta, StoryObj } from '@storybook/angular-vite';
import { AdminKarmaEdataDocument } from '../../../../../generated/graphql/operations';
import { graphqlFixture } from '../../../../../storybook/graphql-fixtures';
import {
  fixtureKarmaEdataMessage,
  fixtureKarmaEdataMessageWithCoordinates,
} from '../../../../../storybook/karma-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../../storybook/story-config';
import { AdminWorkspace } from '../../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/eData',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(): NonNullable<Story['render']> {
  return () => ({
    ...routeAt(
      `karma-client/cars/41/edata?from=2026-01-01T09:00:00&to=2026-01-01T10:00:00&listQ=KARMA&listProject=12&day=2026-01-01#record-context`,
    )(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(AdminKarmaEdataDocument, () => ({
      karmaEdata: {
        __typename: 'KarmaEdataPage',
        items: [fixtureKarmaEdataMessageWithCoordinates],
        hasMore: false,
        cursor: null,
        nextCursor: null,
      },
    }));
    return () => {
      graphqlFixture(AdminKarmaEdataDocument, () => ({
        karmaEdata: {
          __typename: 'KarmaEdataPage',
          items: [fixtureKarmaEdataMessage],
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      }));
    };
  },
};
export const MissingCoordinates: Story = { render: routed() };
export const Mobile: Story = {
  ...Default,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
