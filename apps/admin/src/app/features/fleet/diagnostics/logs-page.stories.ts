import type { Meta, StoryObj } from '@storybook/angular-vite';
import '../../../../storybook/diagnostics-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { LogsPage } from './logs-page';

const meta: Meta = {
  title: 'Admin/Monitoring/Diagnostics/Logs',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(query = ''): NonNullable<Story['render']> {
  const route = routeAt(`${defaultBranchId}/fleet/diagnostics/logs${query}`);
  return () => ({
    ...route(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, LogsPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const FaultStatusDetail: Story = {
  name: 'Fault status detail',
  render: routed('?log=example-log-fault-05'),
};
export const MissingVoltageMeasurement: Story = {
  name: 'Missing voltage measurement',
  render: routed('?log=example-log-measurement-example-position-04-external_voltage'),
};
export const RealUnavailable: Story = { render: routed('?source=KARMA_API') };
export const FilteredEmpty: Story = { render: routed('?search=unmatched-example') };
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
