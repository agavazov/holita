import type { Meta, StoryObj } from '@storybook/angular-vite';
import { AdminFleetDiagnosticsDocument } from '../../../../generated/graphql/operations';
import { fixtureDiagnostics } from '../../../../storybook/diagnostics-fixtures';
import { graphqlFixture } from '../../../../storybook/graphql-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { DiagnosticsWorkspace } from './diagnostics-workspace';
import { FaultsPage } from './faults-page';
import { LogsPage } from './logs-page';
import { RiskPage } from './risk-page';

const meta: Meta = {
  title: 'Admin/Monitoring/Diagnostics/Attention and brief',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

const faultQuery = '?fault=example-fault-01';
const temperatureQuery = '?evaluation=example-evaluation-temperature-01';
const reviewedFilter = encodeURIComponent(
  JSON.stringify([
    { id: 'local-review', field: 'localReview', operator: 'isAnyOf', values: ['REVIEWED'] },
  ]),
);

function routed(
  section: 'faults' | 'logs' | 'risk' = 'faults',
  query = faultQuery,
): NonNullable<Story['render']> {
  const path = `${defaultBranchId}/fleet/diagnostics/${section}${query}`;
  const route = routeAt(path);
  return () => ({
    ...route(),
    moduleMetadata: {
      imports: [
        StoryApp,
        AdminWorkspace,
        FleetWorkspace,
        DiagnosticsWorkspace,
        FaultsPage,
        LogsPage,
        RiskPage,
      ],
    },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };
export const ReportedResolvedStillUnreviewed: Story = {
  render: routed('faults', '?fault=example-fault-02'),
};
export const TemperatureBriefPointSelection: Story = {
  render: routed('risk', temperatureQuery),
};
export const InsufficientDataBrief: Story = {
  render: routed('risk', '?evaluation=example-evaluation-voltage-01'),
};
export const FaultReviewedFilter: Story = {
  render: routed('faults', `${faultQuery}&conditions=${reviewedFilter}`),
};
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const RealUnavailable: Story = {
  render: routed('faults', `${faultQuery}&source=KARMA_API`),
};
export const MissingBriefReferences: Story = {
  render: routed('risk', temperatureQuery),
  beforeEach: () => {
    graphqlFixture(AdminFleetDiagnosticsDocument, (variables) => ({
      ...fixtureDiagnostics,
      fleetScenario: {
        ...fixtureDiagnostics.fleetScenario,
        branchId: variables.branchId ?? defaultBranchId,
        signalSamples: fixtureDiagnostics.fleetScenario.signalSamples.filter(
          (sample) => sample.id !== 'example-position-04-coolant_temperature',
        ),
      },
    }));
    return () => {
      graphqlFixture(AdminFleetDiagnosticsDocument, (variables) => ({
        ...fixtureDiagnostics,
        fleetScenario: {
          ...fixtureDiagnostics.fleetScenario,
          branchId: variables.branchId ?? defaultBranchId,
        },
      }));
    };
  },
};
