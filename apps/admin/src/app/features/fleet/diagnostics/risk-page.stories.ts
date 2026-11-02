import type { Meta, StoryObj } from '@storybook/angular-vite';
import { AdminFleetDiagnosticsDocument } from '../../../../generated/graphql/operations';
import { fixtureDiagnostics } from '../../../../storybook/diagnostics-fixtures';
import { graphqlFixture } from '../../../../storybook/graphql-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { RiskPage } from './risk-page';

const meta: Meta = {
  title: 'Admin/Diagnostics/Risk indicators',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(query = '', language: 'bg' | 'en' = 'en'): NonNullable<Story['render']> {
  const route = routeAt(`${defaultBranchId}/fleet/diagnostics/risk${query}`);
  return () => ({
    ...route(),
    ...(language === 'bg'
      ? { props: { url: `/bg/${defaultBranchId}/fleet/diagnostics/risk${query}` } }
      : {}),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, RiskPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };
export const Bulgarian: Story = { render: routed('', 'bg') };
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { render: routed(), globals: { theme: 'dark' } };
export const BulgarianMobileDark: Story = {
  render: routed('', 'bg'),
  globals: { theme: 'dark', viewport: { value: 'mobile375', isRotated: false } },
};
export const BulgarianMobileDarkDetail: Story = {
  render: routed('?evaluation=example-evaluation-temperature-01', 'bg'),
  globals: { theme: 'dark', viewport: { value: 'mobile375', isRotated: false } },
};
export const RepeatedFaultDetail: Story = {
  name: 'Repeated fault · matched · review',
  render: routed('?evaluation=example-evaluation-fault-01'),
};
export const TemperaturePatternDetail: Story = {
  name: 'Temperature pattern · matched · monitor',
  render: routed('?evaluation=example-evaluation-temperature-01'),
};
export const InsufficientVoltageDetail: Story = {
  name: 'Voltage pattern · insufficient data',
  render: routed('?evaluation=example-evaluation-voltage-01'),
};
export const UnmatchedVoltageDetail: Story = {
  name: 'Voltage pattern · not matched',
  render: routed('?evaluation=example-evaluation-voltage-02'),
};
export const RealUnavailable: Story = { render: routed('?source=KARMA_API') };
export const FilteredEmpty: Story = { render: routed('?search=unmatched-example') };
export const MissingRecord: Story = { render: routed('?evaluation=example-evaluation-missing') };
export const EmptySourceSnapshot: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(AdminFleetDiagnosticsDocument, (variables) => ({
      ...fixtureDiagnostics,
      fleetScenario: {
        ...fixtureDiagnostics.fleetScenario,
        branchId: variables.branchId ?? defaultBranchId,
        ruleEvaluations: [],
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
export const MissingContributor: Story = {
  render: routed('?evaluation=example-evaluation-temperature-01'),
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
export const OutOfFilterSelectedReference: Story = {
  render: routed('?search=unmatched-example&evaluation=example-evaluation-temperature-01'),
};
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminFleetDiagnostics: 'pending' } },
    } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: {
      scenario: { failures: { AdminFleetDiagnostics: 'network' } },
    } satisfies StoryFixtures,
  },
};
