import type { Meta, StoryObj } from '@storybook/angular-vite';
import {
  AdminKarmaPositionSamplesDocument,
  type AdminKarmaPositionSamplesQuery,
} from '../../../../../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from '../../../../../storybook/graphql-fixtures';
import { fixtureKarmaPositionSamples } from '../../../../../storybook/karma-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../../storybook/story-config';
import { AdminWorkspace } from '../../../../workspace/admin-workspace';
import { KarmaWorkspace } from '../../karma-workspace';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Trips/Trip Explorer',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(): NonNullable<Story['render']> {
  return () => ({
    ...routeAt(
      `karma-client/cars/41?day=2026-01-01&listQ=KARMA&listSize=25&listProject=12#trip-9000000001`,
    )(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, KarmaWorkspace] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Loaded: Story = { render: routed() };
export const Partial: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(
      AdminKarmaPositionSamplesDocument,
      (): WithTypename<AdminKarmaPositionSamplesQuery> => {
        const result = fixtureKarmaPositionSamples();
        return {
          karmaPositionSamples: {
            ...result,
            retrieval: 'PARTIAL',
            reason: 'BOUNDARIES_MISSING',
            stopMessagePresent: false,
            samples: result.samples.slice(0, 3),
            loadedRows: 3,
          },
        };
      },
    );
    return restore;
  },
};
export const Empty: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(
      AdminKarmaPositionSamplesDocument,
      (): WithTypename<AdminKarmaPositionSamplesQuery> => ({
        karmaPositionSamples: {
          ...fixtureKarmaPositionSamples(),
          retrieval: 'PARTIAL',
          reason: 'BOUNDARIES_MISSING',
          samples: [],
          loadedRows: 0,
          startMessagePresent: false,
          stopMessagePresent: false,
        },
      }),
    );
    return restore;
  },
};
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminKarmaPositionSamples: 'pending' } },
    } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminKarmaPositionSamples: 'network' } },
    } satisfies StoryFixtures,
  },
};
export const Mobile: Story = {
  ...Loaded,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

function restore(): void {
  graphqlFixture(AdminKarmaPositionSamplesDocument, (variables) => {
    const input = variables.object('input');
    return {
      karmaPositionSamples: fixtureKarmaPositionSamples(
        input.requiredString('carId'),
        input.requiredString('startMessageId'),
        input.requiredString('stopMessageId'),
      ),
    };
  });
}
