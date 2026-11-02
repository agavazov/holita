import '../../../../storybook/diagnostics-fixtures';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { FaultsPage } from './faults-page';
import { LogsPage } from './logs-page';
import { RiskPage } from './risk-page';

const meta: Meta = {
  title: 'Admin/Monitoring/Diagnostics/Vehicle context',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

const faultQuery = '?fault=example-fault-01&vehicleSummary=example-truck-01';
const logQuery =
  '?log=example-log-measurement-example-position-04-external_voltage&vehicleSummary=example-truck-01';
const riskQuery = '?evaluation=example-evaluation-temperature-01&vehicleSummary=example-truck-01';
const outsideCoverageDay = encodeURIComponent(
  JSON.stringify([{ id: 'day', field: 'observedOn', operator: 'on', values: ['2026-10-22'] }]),
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
      imports: [StoryApp, AdminWorkspace, FleetWorkspace, FaultsPage, LogsPage, RiskPage],
    },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };
export const FromLogMeasurementUnavailable: Story = {
  render: routed('logs', logQuery),
};
export const FromRisk: Story = { render: routed('risk', riskQuery) };
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const OutsideCoverageDay: Story = {
  render: routed('risk', `${riskQuery}&conditions=${outsideCoverageDay}`),
};
export const RealUnavailable: Story = {
  render: routed('faults', `${faultQuery}&source=KARMA_API`),
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
