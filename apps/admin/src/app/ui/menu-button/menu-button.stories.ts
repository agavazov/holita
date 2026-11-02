import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
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

/** Open the popup to review its options and keyboard navigation. */
export const Default: Story = {};

/** An unavailable trigger stays in keyboard order and announces its state. */
export const Disabled: Story = {
  args: { disabled: true },
};
