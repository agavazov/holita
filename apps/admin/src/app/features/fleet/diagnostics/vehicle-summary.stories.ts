import type { Meta, StoryObj } from '@storybook/angular-vite';
import { AdminFleetDiagnosticsDocument } from '../../../../generated/graphql/operations';
import { fixtureDiagnostics } from '../../../../storybook/diagnostics-fixtures';
import { graphqlFixture } from '../../../../storybook/graphql-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { FaultsPage } from './faults-page';
import { LogsPage } from './logs-page';
import { RiskPage } from './risk-page';

const meta: Meta = {
  title: 'Admin/Diagnostics/Vehicle context',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

const faultQuery = '?fault=example-fault-01&vehicleSummary=example-truck-01';
const logQuery =
  '?log=example-log-measurement-example-position-04-external_voltage&vehicleSummary=example-truck-01';
const riskQuery = '?evaluation=example-evaluation-temperature-01&vehicleSummary=example-truck-01';
const observationDay = encodeURIComponent(
  JSON.stringify([{ id: 'day', field: 'observedOn', operator: 'on', values: ['2026-10-20'] }]),
);
const outsideCoverageDay = encodeURIComponent(
  JSON.stringify([{ id: 'day', field: 'observedOn', operator: 'on', values: ['2026-10-22'] }]),
);

function routed(
  section: 'faults' | 'logs' | 'risk' = 'faults',
  query = faultQuery,
  language: 'bg' | 'en' = 'en',
): NonNullable<Story['render']> {
  const path = `${defaultBranchId}/fleet/diagnostics/${section}${query}`;
  const route = routeAt(path);
  return () => ({
    ...route(),
    ...(language === 'bg' ? { props: { url: `/bg/${path}` } } : {}),
    moduleMetadata: {
      imports: [StoryApp, AdminWorkspace, FleetWorkspace, FaultsPage, LogsPage, RiskPage],
    },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };
export const FromFault: Story = { render: routed() };
export const FromLogMeasurementUnavailable: Story = {
  render: routed('logs', logQuery),
};
export const FromRisk: Story = { render: routed('risk', riskQuery) };
export const Bulgarian: Story = { render: routed('faults', faultQuery, 'bg') };
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { render: routed(), globals: { theme: 'dark' } };
export const BulgarianMobileDark: Story = {
  render: routed('risk', riskQuery, 'bg'),
  globals: { theme: 'dark', viewport: { value: 'mobile375', isRotated: false } },
};
export const ObservationDay: Story = {
  render: routed('risk', `${riskQuery}&conditions=${observationDay}`),
};
export const OutsideCoverageDay: Story = {
  render: routed('risk', `${riskQuery}&conditions=${outsideCoverageDay}`),
};
export const UnknownVehicle: Story = {
  render: routed('faults', '?fault=example-fault-01&vehicleSummary=example-truck-missing'),
};
export const RealUnavailable: Story = {
  render: routed('faults', `${faultQuery}&source=KARMA_API`),
};
export const MissingReferences: Story = {
  render: routed('risk', riskQuery),
  beforeEach: () => {
    graphqlFixture(AdminFleetDiagnosticsDocument, (variables) => ({
      ...fixtureDiagnostics,
      fleetScenario: {
        ...fixtureDiagnostics.fleetScenario,
        branchId: variables.branchId ?? defaultBranchId,
        signalSamples: fixtureDiagnostics.fleetScenario.signalSamples.filter(
          (sample) => sample.id !== 'example-position-04-coolant_temperature',
        ),
        logs: fixtureDiagnostics.fleetScenario.logs.filter(
          (log) =>
            log.id !== 'example-log-fault-02' &&
            log.id !== 'example-log-measurement-example-position-04-coolant_temperature',
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
