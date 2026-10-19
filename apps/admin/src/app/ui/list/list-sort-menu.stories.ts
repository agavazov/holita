import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../storybook/interactions';
import type { ListQuery } from './list-query';
import { ListSortMenu } from './list-sort-menu';

@Component({
  selector: 'holita-sort-menu-story',
  imports: [ListSortMenu],
  template: `<holita-list-sort-menu
    [fields]="fields"
    [sort]="sort()"
    (sortChange)="sort.set($event)"
  />`,
})
class SortMenuStory {
  readonly fields = [
    { field: 'name', label: 'Name' },
    { field: 'createdAt', label: 'Created at' },
  ];
  readonly sort = signal<ListQuery['sort']>({ field: 'name', direction: 'asc' });
}

const meta: Meta<SortMenuStory> = {
  title: 'Design System/Patterns/List sort',
  component: SortMenuStory,
};
export default meta;
type Story = StoryObj<SortMenuStory>;

export const FieldAndDirection: Story = {
  name: 'Choose a field and direction',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Created at');
    await expect(canvas.getByRole('button', { name: /^Sort/ })).toHaveTextContent('Created at');
    await userEvent.click(canvas.getByRole('button', { name: /^Sort/ }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Descending');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /^Sort/ })).toHaveTextContent('↓'),
    );
    await expect(canvas.getByRole('button', { name: /^Sort/ })).toHaveFocus();
  },
};
