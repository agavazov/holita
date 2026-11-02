import type { Meta, StoryObj } from '@storybook/angular-vite';
import { AdminFleetScenarioDocument } from '../../../../generated/graphql/operations';
import '../../../../storybook/diagnostics-fixtures';
import { graphqlFixture } from '../../../../storybook/graphql-fixtures';
import { fixtureScenario } from '../../../../storybook/scenario-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { ExampleScenarioPage } from './example-scenario-page';

const meta: Meta = {
  title: 'Admin/Karma Client/Trucks/Truck/Overview/Example day',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(fragment = ''): NonNullable<Story['render']> {
  const route = routeAt(`${defaultBranchId}/fleet/scenarios/operational-day-v1${fragment}`);
  return () => ({
    ...route(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, ExampleScenarioPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };
export const TripDetail: Story = { render: routed('#trip-example-trip-01') };
export const SelectedPositionAfterGap: Story = {
  render: routed(
    '?sampleTrip=example-trip-01&samplePoint=example-position-04#trip-example-trip-01',
  ),
};
export const FuelCounterReset: Story = {
  render: routed(
    '?sampleTrip=example-trip-01&sampleView=measurements&sampleChannel=FUEL_USED&samplePoint=example-position-04#trip-example-trip-01',
  ),
};
export const VoltageGapAndMissingValue: Story = {
  render: routed(
    '?sampleTrip=example-trip-01&sampleView=measurements&sampleChannel=EXTERNAL_VOLTAGE&samplePoint=example-position-04#trip-example-trip-01',
  ),
};
export const NoSampledPositions: Story = {
  render: routed('?sampleTrip=example-trip-01#trip-example-trip-01'),
  beforeEach: () => {
    graphqlFixture(AdminFleetScenarioDocument, (variables) => ({
      fleetScenario: {
        ...fixtureScenario,
        branchId: variables.branchId ?? defaultBranchId,
        positionSamples: [],
        signalSamples: [],
        coverage: { ...fixtureScenario.coverage, positionsLoaded: 0 },
      },
    }));
    return () => {
      graphqlFixture(AdminFleetScenarioDocument, (variables) => ({
        fleetScenario: { ...fixtureScenario, branchId: variables.branchId ?? defaultBranchId },
      }));
    };
  },
};
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminFleetScenario: 'pending' } } } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminFleetScenario: 'network' } } } satisfies StoryFixtures,
  },
};
