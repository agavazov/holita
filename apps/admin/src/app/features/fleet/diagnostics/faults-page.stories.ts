import type { Meta, StoryObj } from '@storybook/angular-vite';
import { AdminFleetDiagnosticsDocument } from '../../../../generated/graphql/operations';
import { fixtureDiagnostics } from '../../../../storybook/diagnostics-fixtures';
import { graphqlFixture } from '../../../../storybook/graphql-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { FaultsPage } from './faults-page';

const meta: Meta = {
  title: 'Admin/Diagnostics/Faults',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;

function routed(query = '', language: 'bg' | 'en' = 'en'): NonNullable<Story['render']> {
  const route = routeAt(`${defaultBranchId}/fleet/diagnostics/faults${query}`);
  return () => ({
    ...route(),
    ...(language === 'bg'
      ? { props: { url: `/bg/${defaultBranchId}/fleet/diagnostics/faults${query}` } }
      : {}),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, FleetWorkspace, FaultsPage] },
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
export const ActiveDetail: Story = {
  name: 'Active detail',
  render: routed('?fault=example-fault-01'),
};
export const ResolvedHistoryDetail: Story = {
  name: 'Resolved/history detail',
  render: routed('?fault=example-fault-02'),
};
export const RealUnavailable: Story = { render: routed('?source=KARMA_API') };
export const FilteredEmpty: Story = { render: routed('?search=unmatched-example') };
export const MissingRecord: Story = { render: routed('?fault=example-fault-missing') };
export const EmptySourceSnapshot: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(AdminFleetDiagnosticsDocument, (variables) => ({
      ...fixtureDiagnostics,
      fleetScenario: {
        ...fixtureDiagnostics.fleetScenario,
        branchId: variables.branchId ?? defaultBranchId,
        faults: [],
        logs: [],
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
