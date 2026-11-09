import {
  componentWrapperDecorator,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular-vite';
import { Tag } from 'primeng/tag';
import { onFrame } from '../../../storybook/story-config';
import { ModuleInfoDialog } from './module-info-dialog';
import { PageHeader } from './page-header';

const meta: Meta<PageHeader> = {
  title: 'Design System/Patterns/PageHeader',
  component: PageHeader,
  decorators: [
    moduleMetadata({ imports: [Tag, ModuleInfoDialog] }),
    componentWrapperDecorator((story) => `${story}<holita-module-info-dialog />`),
    onFrame,
  ],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<PageHeader>;

export const List: Story = {
  render: () => ({
    template: `
      <holita-page-header
        title="Vehicles"
        [count]="46"
        moduleInfo="Vehicles shows the fleet and its current reporting status. You can maintain vehicle details and open their history."
        [actions]="[
          { id: 'create', label: 'New vehicle', primary: true },
          { id: 'refresh', label: 'Refresh' }
        ]"
      />
    `,
  }),
};

export const DetailWithBackLink: Story = {
  name: 'Detail with back link',
  render: () => ({
    template: `
      <holita-page-header
        [backLink]="['/', 'en']"
        backLabel="Vehicles"
        title="CB 1004 AX"
        moduleInfoTitle="Vehicle overview"
        moduleInfo="The vehicle profile combines device readings, trips and maintenance. Authorized users can edit the vehicle and record odometer readings."
        [actions]="[
          { id: 'edit', label: 'Edit', primary: true },
          { id: 'odometer', label: 'Record odometer' }
        ]"
      >
        <p-tag headerMeta severity="success" value="Active" />
      </holita-page-header>
    `,
  }),
};

export const LongTitle: Story = {
  name: 'Long title',
  render: () => ({
    template: `
      <holita-page-header
        title="Aleksandar-Kristiyan Petrov-Stoyanov Georgiev-Dimitrov Ivanov"
        [count]="1234"
        moduleInfo="The driver scorecard summarizes driving data for a selected period. You can review scores and recorded maneuvers."
        [actions]="[{ id: 'edit', label: 'Edit', primary: true, disabled: true }]"
      />
    `,
  }),
};
