import '../../../../storybook/diagnostics-fixtures';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { RiskPage } from './risk-page';

const meta: Meta = {
  title: 'Admin/Monitoring/Diagnostics/Risk indicators',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(query = ''): NonNullable<Story['render']> {
  const route = routeAt(`${defaultBranchId}/fleet/diagnostics/risk${query}`);
  return () => ({
    ...route(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, RiskPage] },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = { render: routed() };
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const TemperaturePatternDetail: Story = {
  name: 'Temperature pattern · matched · monitor',
  render: routed('?evaluation=example-evaluation-temperature-01'),
};
export const InsufficientVoltageDetail: Story = {
  name: 'Voltage pattern · insufficient data',
  render: routed('?evaluation=example-evaluation-voltage-01'),
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
