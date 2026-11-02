import type { Meta, StoryObj } from '@storybook/angular-vite';
import { userEvent, within } from 'storybook/test';
import { AdminKarmaEventsDocument } from '../../../../../generated/graphql/operations';
import { graphqlFixture } from '../../../../../storybook/graphql-fixtures';
import {
  fixtureKarmaEvent,
  fixtureKarmaEventWithCoordinates,
} from '../../../../../storybook/karma-fixtures';
import { StoryApp, type StoryFixtures } from '../../../../../storybook/story-config';
import { AdminWorkspace } from '../../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Event position',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(language = 'en'): NonNullable<Story['render']> {
  return () => ({
    props: {
      url: `/${language}/karma-client/cars/41/events?from=2026-01-01T09:00:00&to=2026-01-01T10:00:00&types=0&listQ=KARMA&listProject=12&day=2026-01-01#record-context`,
    },
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

const openEvent: Story['play'] = async ({ canvasElement }) => {
  const trigger = await within(canvasElement).findByRole(
    'button',
    { name: /^(View|Преглед) 3000000600$/ },
    { timeout: 10000 },
  );
  await userEvent.click(trigger);
};

export const WithCoordinates: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(AdminKarmaEventsDocument, () => ({
      karmaEvents: {
        __typename: 'KarmaEventsPage',
        items: [fixtureKarmaEventWithCoordinates],
        hasMore: false,
        cursor: null,
        nextCursor: null,
      },
    }));
    return () => {
      graphqlFixture(AdminKarmaEventsDocument, () => ({
        karmaEvents: {
          __typename: 'KarmaEventsPage',
          items: [fixtureKarmaEvent],
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      }));
    };
  },
  play: openEvent,
};
export const MissingCoordinates: Story = { render: routed(), play: openEvent };
export const Bulgarian: Story = { ...WithCoordinates, render: routed('bg') };
export const Mobile: Story = {
  ...Bulgarian,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { ...WithCoordinates, globals: { theme: 'dark' } };
