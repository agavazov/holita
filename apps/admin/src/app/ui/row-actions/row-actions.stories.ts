import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../storybook/interactions';
import { onFrame } from '../../../storybook/story-config';
import type { ListActionBase, ListRecord } from '../list/list-actions';
import { RowActions, type RowChoice } from './row-actions';

type Action = 'edit' | 'deactivate' | 'delete';

@Component({
  selector: 'holita-row-actions-story',
  imports: [RowActions],
  template: `
    <div class="app-inline">
      <span>CB 1001 AX</span>
      <holita-row-actions [actions]="actions" [record]="record" (choose)="chosen.set($event)" />
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
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for CB 1001 AX' }));
    await waitFor(async () => {
      await expect(body.getByRole('menu', { name: 'Actions for CB 1001 AX' })).toBeVisible();
      await expect(body.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    });
  },
};

/** The record names its trigger; destructive actions follow a separator. */
export const Actions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Actions for CB 1001 AX' });
    await userEvent.click(trigger);
    const menu = await body.findByRole('menu', { name: 'Actions for CB 1001 AX' });
    await expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent.trim()),
    ).toEqual(['Edit', 'Deactivate', 'Delete']);
    await expect(within(menu).getAllByRole('separator')).toHaveLength(1);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Edit');
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Last action: edit');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveFocus();
    });
  },
};

/** Disabled record actions cannot emit; keyboard traversal skips them. */
export const DisabledAndKeyboard: Story = {
  name: 'Disabled action and keyboard',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Actions for CB 1001 AX' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const menu = await body.findByRole('menu', { name: 'Actions for CB 1001 AX' });
    await expect(within(menu).getByRole('menuitem', { name: 'Deactivate' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(within(menu).getByRole('menuitem', { name: 'Deactivate' })).toHaveStyle({
      pointerEvents: 'none',
    });
    await expect(canvas.getByRole('status')).toHaveTextContent('Last action: None');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    menu.focus();
    await userEvent.keyboard('{Home}{ArrowDown}');
    await waitFor(async () => {
      await expect(menu).toHaveAttribute(
        'aria-activedescendant',
        within(menu).getByRole('menuitem', { name: 'Delete' }).id,
      );
    });
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Last action: delete');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveFocus();
    });
  },
};
