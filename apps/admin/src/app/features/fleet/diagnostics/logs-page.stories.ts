import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../../storybook/diagnostics-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { LogsPage } from './logs-page';

const meta: Meta = {
  title: 'Admin/Diagnostics/Logs',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

const observationDay = encodeURIComponent(
  JSON.stringify([{ id: 'day', field: 'observedOn', operator: 'on', values: ['2026-10-20'] }]),
);

function routed(query = '', language: 'bg' | 'en' = 'en'): NonNullable<Story['render']> {
  const route = routeAt(`${defaultBranchId}/fleet/diagnostics/logs${query}`);
  return () => ({
    ...route(),
    ...(language === 'bg'
      ? { props: { url: `/bg/${defaultBranchId}/fleet/diagnostics/logs${query}` } }
      : {}),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, LogsPage] },
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
export const FaultStatusDetail: Story = {
  name: 'Fault status detail',
  render: routed('?log=example-log-fault-05'),
};
export const MeasurementZero: Story = {
  name: 'Measurement zero',
  render: routed('?log=example-log-measurement-example-position-01-speed'),
};
export const MissingVoltageMeasurement: Story = {
  name: 'Missing voltage measurement',
  render: routed('?log=example-log-measurement-example-position-04-external_voltage'),
};
export const Availability: Story = { render: routed('?log=example-log-availability-01') };
export const Integration: Story = { render: routed('?log=example-log-integration-01') };
export const EvaluationObservationDay: Story = {
  name: 'Evaluation next-day processing in observation day',
  render: routed(`?conditions=${observationDay}&log=example-log-example-evaluation-temperature-01`),
};
export const RealUnavailable: Story = { render: routed('?source=KARMA_API') };
export const FilteredEmpty: Story = { render: routed('?search=unmatched-example') };
export const MissingRecord: Story = { render: routed('?log=example-log-missing') };
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
