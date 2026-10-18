import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { Plus } from '@primeicons/angular/plus';
import { Refresh } from '@primeicons/angular/refresh';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { onFrame } from '../../../storybook/story-config';
import { PageHeader } from './page-header';

const meta: Meta<PageHeader> = {
  title: 'Design System/Patterns/PageHeader',
  component: PageHeader,
  decorators: [moduleMetadata({ imports: [ButtonDirective, Tag, Plus, Refresh] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<PageHeader>;

export const List: Story = {
  render: () => ({
    template: `
      <holita-page-header
        eyebrow="Fleet"
        title="Vehicles"
        [count]="46"
        description="Tractor units, trailers and vans in the Discordia branch"
      >
        <span headerMeta class="app-muted" style="font-size: var(--p-app-text-sm)">Data as of Oct 18, 2026 09:30</span>
        <button headerActions pButton type="button" severity="secondary" [outlined]="true" aria-label="Refresh">
          <svg data-p-icon="refresh" aria-hidden="true"></svg>
        </button>
        <a headerActions pButton href="#new">
          <svg data-p-icon="plus" aria-hidden="true"></svg>
          New vehicle
        </a>
      </holita-page-header>
    `,
  }),
};

export const DetailWithBackLink: Story = {
  name: 'Detail with back link',
  render: () => ({
    template: `
      <holita-page-header
        [backLink]="['/', 'bg']"
        backLabel="Vehicles"
        eyebrow="T-04 · Tractor unit · International"
        title="CB 1004 AX"
        description="MAN TGX 18.510 · 2021 · VIN WMA06XZZ1MP123456"
      >
        <p-tag headerMeta severity="success" value="Active" />
        <button headerActions pButton type="button" severity="secondary" [outlined]="true">Edit</button>
      </holita-page-header>
    `,
  }),
};

export const LongTitle: Story = {
  name: 'Long title',
  render: () => ({
    template: `
      <holita-page-header
        eyebrow="Drivers · International haulage · Long-term contracts"
        title="Aleksandar-Kristiyan Petrov-Stoyanov Georgiev-Dimitrov Ivanov"
        [count]="1234"
        description="A very long description that is truncated to a single line so it does not push the actions and the content below the page title aside on narrow screens."
      >
        <button headerActions pButton type="button">Action</button>
      </holita-page-header>
    `,
  }),
};
