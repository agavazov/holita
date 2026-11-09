import { Component, signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import type { ListQuery } from './list-query';
import { ListSortMenu } from './list-sort-menu';

@Component({
  selector: 'discocan-sort-menu-story',
  imports: [ListSortMenu],
  template: `<discocan-list-sort-menu
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
};
