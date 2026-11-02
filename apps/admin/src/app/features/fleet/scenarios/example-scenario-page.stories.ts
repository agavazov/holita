import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../../storybook/diagnostics-fixtures';
import { AdminFleetScenarioDocument } from '../../../../generated/graphql/operations';
import { graphqlFixture } from '../../../../storybook/graphql-fixtures';
import { fixtureScenario } from '../../../../storybook/scenario-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { ExampleScenarioPage } from './example-scenario-page';

const meta: Meta = {
  title: 'Admin/Trucks/Example day',
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
export const ReturnTripPosition: Story = {
  render: routed(
    '?sampleTrip=example-trip-02&samplePoint=example-position-07#trip-example-trip-02',
  ),
};
export const FuelCounterReset: Story = {
  render: routed(
    '?sampleTrip=example-trip-01&sampleView=measurements&sampleChannel=FUEL_USED&samplePoint=example-position-04#trip-example-trip-01',
  ),
};
export const TemperatureMeasurements: Story = {
  render: routed(
    '?sampleTrip=example-trip-01&sampleView=measurements&sampleChannel=COOLANT_TEMPERATURE&samplePoint=example-position-03#trip-example-trip-01',
  ),
};
export const VoltageGapAndMissingValue: Story = {
  render: routed(
    '?sampleTrip=example-trip-01&sampleView=measurements&sampleChannel=EXTERNAL_VOLTAGE&samplePoint=example-position-04#trip-example-trip-01',
  ),
};
export const ReturnTripMeasurements: Story = {
  render: routed(
    '?sampleTrip=example-trip-02&sampleView=measurements&sampleChannel=ENGINE_HOURS&samplePoint=example-position-07#trip-example-trip-02',
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
