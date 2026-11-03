import type { Meta, StoryObj } from '@storybook/angular-vite';
import { AdminErmUnitsDocument } from '../../../generated/graphql/operations';
import { graphqlFixture } from '../../../storybook/graphql-fixtures';
import { fixtureErmUnitId, fixtureErmUnits } from '../../../storybook/erm-server-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../storybook/story-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { ErmWorkspace } from './erm-workspace';
import { ErmPage } from './erm-page';

const meta: Meta = {
  title: 'Admin/ERM Server/Units',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj;
function routed(path = ''): NonNullable<Story['render']> {
  const render = routeAt('erm-server' + path);
  return () => ({
    ...render(),
    moduleMetadata: { imports: [StoryApp, AdminWorkspace, ErmWorkspace, ErmPage] },
    template: '<holita-story-app [url]="url" />',
  });
}
export const Default: Story = { render: routed() };
export const UnitEvents: Story = { render: routed('/' + fixtureErmUnitId) };
export const UnitFrames: Story = { render: routed('/' + fixtureErmUnitId + '?view=frames') };
export const UnitCommands: Story = { render: routed('/' + fixtureErmUnitId + '?view=commands') };
export const Loading: Story = {
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminErmUnits: 'pending' } } } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminErmUnits: 'network' } } } satisfies StoryFixtures,
  },
};
export const Empty: Story = {
  render: routed(),
  beforeEach: () => {
    graphqlFixture(AdminErmUnitsDocument, () => ({ ermUnits: { ...fixtureErmUnits, items: [] } }));
    return () => {
      graphqlFixture(AdminErmUnitsDocument, () => ({ ermUnits: fixtureErmUnits }));
    };
  },
};
export const Mobile: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
