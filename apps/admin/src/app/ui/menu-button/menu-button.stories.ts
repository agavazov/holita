import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../storybook/interactions';
import { onFrame } from '../../../storybook/story-config';
import { MenuButton, type MenuChoice, type MenuOption } from './menu-button';

@Component({
  selector: 'holita-menu-button-story',
  imports: [MenuButton],
  template: `
    <holita-menu-button
      variant="text"
      ariaLabel="Choose branch: Sofia Fleet"
      [options]="options"
      [disabled]="disabled()"
      (choose)="chosen.set($event)"
    >
      Sofia Fleet
    </holita-menu-button>
    <p role="status" class="app-muted">Last choice: {{ chosen()?.id ?? 'None' }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MenuButtonStory {
  readonly disabled = input(false);
  readonly chosen = signal<MenuChoice | null>(null);
  readonly options: readonly MenuOption[] = [
    { id: 'sofia', label: 'Sofia Fleet', selected: true },
    { id: 'varna', label: 'Varna Fleet', disabled: true },
    { id: 'plovdiv', label: 'Plovdiv Fleet' },
  ];
}

const meta: Meta<MenuButtonStory> = {
  title: 'Design System/Patterns/MenuButton',
  component: MenuButtonStory,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<MenuButtonStory>;

/** Keep the popup open for its visual and accessibility review. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Choose branch: Sofia Fleet' }));
    await waitFor(async () => {
      await expect(body.getByRole('menu', { name: 'Choose branch: Sofia Fleet' })).toBeVisible();
      await expect(
        body.getByRole('menuitem', { name: /^Sofia Fleet\s*, current choice$/ }),
      ).toBeVisible();
    });
  },
};

/** Enter opens on the current choice; ArrowDown skips an unavailable option. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Choose branch: Sofia Fleet' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const menu = await body.findByRole('menu', { name: 'Choose branch: Sofia Fleet' });
    const current = within(menu).getByRole('menuitem', {
      name: /^Sofia Fleet\s*, current choice$/,
    });
    await waitFor(async () => {
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(menu).toHaveAttribute('aria-activedescendant', current.id);
    });
    await expect(within(menu).getByRole('menuitem', { name: 'Varna Fleet' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    menu.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(async () => {
      await expect(menu).toHaveAttribute(
        'aria-activedescendant',
        within(menu).getByRole('menuitem', { name: 'Plovdiv Fleet' }).id,
      );
    });
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Last choice: plovdiv');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveFocus();
    });
  },
};

export const PointerAndEscape: Story = {
  name: 'Pointer choice and Escape',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Choose branch: Sofia Fleet' });
    await userEvent.click(trigger);
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Plovdiv Fleet');
    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent('Last choice: plovdiv');
      await expect(trigger).toHaveFocus();
    });
    await userEvent.click(trigger);
    const menu = await body.findByRole('menu', { name: 'Choose branch: Sofia Fleet' });
    menu.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveFocus();
    });
    await expect(canvas.getByRole('status')).toHaveTextContent('Last choice: plovdiv');
  },
};

/** An unavailable trigger stays in keyboard order and announces its state. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Choose branch: Sofia Fleet' });
    trigger.focus();
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(body.queryByRole('menu')).toBeNull();
    await expect(canvas.getByRole('status')).toHaveTextContent('Last choice: None');
  },
};
