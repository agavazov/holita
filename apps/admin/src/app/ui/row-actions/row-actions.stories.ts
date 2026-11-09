import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { onFrame } from '../../../storybook/story-config';
import type { ListActionBase, ListRecord } from '../list/list-actions';
import { RowActions, type RowChoice } from './row-actions';

type Action = 'edit' | 'deactivate' | 'delete';

@Component({
  selector: 'discocan-row-actions-story',
  imports: [RowActions],
  template: `
    <div class="app-inline">
      <span>CB 1001 AX</span>
      <discocan-row-actions [actions]="actions" [record]="record" (choose)="chosen.set($event)" />
    </div>
    <p role="status" class="app-muted">Last action: {{ chosen()?.action ?? 'None' }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RowActionsStory {
  readonly actions: readonly ListActionBase<Action>[] = [
    { id: 'delete', label: 'Delete', danger: true, bulk: true },
    { id: 'edit', label: 'Edit' },
    { id: 'deactivate', label: 'Deactivate', bulk: true },
  ];
  readonly record: ListRecord<Action> = {
    id: 'vehicle-1',
    label: 'CB 1001 AX',
    unavailable: ['deactivate'],
  };
  readonly chosen = signal<RowChoice<Action> | null>(null);
}

const meta: Meta<RowActionsStory> = {
  title: 'Design System/Patterns/RowActions',
  component: RowActionsStory,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<RowActionsStory>;

/** The open popup includes its disabled and destructive states in the axe review. */
export const Default: Story = {};
