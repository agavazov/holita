import type { Meta, StoryObj } from '@storybook/angular-vite';
import { userEvent, within } from 'storybook/test';
import { AdminKarmaEdataDocument } from '../../../../../generated/graphql/operations';
import { graphqlFixture } from '../../../../../storybook/graphql-fixtures';
import {
  fixtureKarmaEdataMessage,
  fixtureKarmaEdataMessageWithCoordinates,
} from '../../../../../storybook/karma-fixtures';
import { StoryApp, type StoryFixtures } from '../../../../../storybook/story-config';
import { AdminWorkspace } from '../../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/eData message position',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(language = 'en'): NonNullable<Story['render']> {
  return () => ({
    props: {
      url: `/${language}/karma-client/cars/41/edata?from=2026-01-01T09:00:00&to=2026-01-01T10:00:00&listQ=KARMA&listProject=12&day=2026-01-01#record-context`,
    },
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

const openMessage: Story['play'] = async ({ canvasElement }) => {
  const trigger = await within(canvasElement).findByRole(
    'button',
    { name: /^(View message|Преглед на съобщение) 3000000600$/ },
    { timeout: 10000 },
  );
  await userEvent.click(trigger);
};

export const WithCoordinates: Story = {
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
  play: openMessage,
};
export const MissingCoordinates: Story = { render: routed(), play: openMessage };
export const Bulgarian: Story = { ...WithCoordinates, render: routed('bg') };
export const Mobile: Story = {
  ...Bulgarian,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { ...WithCoordinates, globals: { theme: 'dark' } };
