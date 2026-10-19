import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { uiMessages } from '../i18n/messages';
import { MenuButton, type MenuOption } from '../menu-button/menu-button';
import { UI_LANGUAGE } from '../ui-language';
import type { ListQuery } from './list-query';

export interface ListSortField {
  readonly field: string;
  readonly label: string;
}

/** A field and direction menu for list sorts, including fields without a visible column. */
@Component({
  selector: 'holita-list-sort-menu',
  imports: [MenuButton],
  template: `
    <holita-menu-button
      variant="text"
      menuClass="app-menu-scroll"
      [options]="options()"
      (choose)="choose($event.id)"
    >
      {{ text().label }}{{ selectedLabel() ? ': ' + selectedLabel() : '' }}
      @if (sort(); as sort) {
        <span aria-hidden="true">{{ sort.direction === 'asc' ? '↑' : '↓' }}</span>
      }
    </holita-menu-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListSortMenu {
  readonly fields = input.required<readonly ListSortField[]>();
  readonly sort = input<ListQuery['sort']>(null);
  readonly sortChange = output<NonNullable<ListQuery['sort']>>();

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()].sort);
  protected readonly selectedLabel = computed(
    () => this.fields().find((field) => field.field === this.sort()?.field)?.label ?? null,
  );
  protected readonly options = computed<readonly MenuOption[]>(() => [
    ...this.fields().map((field) => ({
      id: `field:${field.field}`,
      label: field.label,
      selected: this.sort()?.field === field.field,
    })),
    {
      id: 'direction:asc',
      label: this.text().ascending,
      separated: true,
      selected: this.sort()?.direction === 'asc',
      disabled: this.sort() === null,
    },
    {
      id: 'direction:desc',
      label: this.text().descending,
      selected: this.sort()?.direction === 'desc',
      disabled: this.sort() === null,
    },
  ]);

  protected choose(id: string): void {
    const current = this.sort();
    const field = this.fields().find((field) => `field:${field.field}` === id);
    if (field) {
      if (field.field !== current?.field) {
        this.sortChange.emit({ field: field.field, direction: current?.direction ?? 'asc' });
      }
      return;
    }
    if (!current) {
      return;
    }
    const direction = id === 'direction:asc' ? 'asc' : id === 'direction:desc' ? 'desc' : null;
    if (direction && direction !== current.direction) {
      this.sortChange.emit({ field: current.field, direction });
    }
  }
}
