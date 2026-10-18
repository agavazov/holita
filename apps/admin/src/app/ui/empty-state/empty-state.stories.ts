import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { onFrame } from '../../../storybook/story-config';
import { EmptyState } from './empty-state';

const meta: Meta<EmptyState> = {
  title: 'Design System/Patterns/EmptyState',
  component: EmptyState,
  decorators: [moduleMetadata({ imports: [ButtonDirective] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<EmptyState>;

export const AllKinds: Story = {
  name: 'All kinds',
  render: () => ({
    template: `
      <div class="app-card-grid">
        <div class="app-card"><holita-empty-state kind="empty" title="No drivers yet" description="Add the first driver to this branch."><button emptyActions pButton type="button">New driver</button></holita-empty-state></div>
        <div class="app-card"><holita-empty-state kind="no-results" title="No matching records" description="Change the search or the filters."><button emptyActions pButton type="button" severity="secondary" [outlined]="true">Clear filters</button></holita-empty-state></div>
        <div class="app-card"><holita-empty-state kind="error" title="The list could not be loaded" description="Cannot reach the gateway. (fixture-AdminFleetVehicles)"><button emptyActions pButton type="button">Try again</button></holita-empty-state></div>
        <div class="app-card"><holita-empty-state kind="not-found" title="Branch not found" description="Select an available branch." /></div>
        <div class="app-card"><holita-empty-state kind="disabled" title="Fleet is unavailable" description="The module is disabled in the configuration." /></div>
        <div class="app-card"><holita-empty-state kind="no-telemetry" title="No telemetry" description="The branch's devices have not sent any data yet." [compact]="true" /></div>
        <div class="app-card"><holita-empty-state kind="done" title="No open alarms" description="All alarms have been acknowledged or resolved." [compact]="true" /></div>
      </div>
    `,
  }),
};
