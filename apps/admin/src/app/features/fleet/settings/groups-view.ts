import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { FormatNumberPipe } from '../../../ui/format/format.pipes';
import { interpolate } from '../../../ui/i18n/messages';
import {
  type ListAction,
  type ListActionRequest,
  type ListRecord,
  listRecord,
  trackById,
} from '../../../ui/list/list-actions';
import { injectSortReady, type ListQuery } from '../../../ui/list/list-query';
import { ListSortMenu } from '../../../ui/list/list-sort-menu';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel, type TableColumn, type TablePage } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { settingsText } from './i18n/messages';
import bg from './groups-view.bg.json';
import en from './groups-view.en.json';

export type GroupActionId = 'edit' | 'delete';

/** One vehicle group with the number of vehicles in it. */
export interface GroupRow {
  readonly id: string;
  readonly name: string;
  readonly slot: string;
  readonly description: string;
  readonly vehicles: number;
}

/**
 * A paged settings list with identity and vehicle counts. Groups in use cannot be deleted.
 */
@Component({
  selector: 'discocan-groups-view',
  imports: [
    ButtonDirective,
    TableModule,
    FormatNumberPipe,
    ListSortMenu,
    PageHeader,
    RowActions,
    TablePanel,
  ],
  templateUrl: './groups-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class GroupsView {
  readonly rows = input.required<readonly GroupRow[]>();
  readonly page = input.required<TablePage>();
  readonly view = input.required<TableView>();
  readonly busy = input(false);
  readonly canEdit = input(true);
  readonly errorText = input<string | null>(null);
  readonly actionContext = input<unknown>(null);
  readonly sortDirection = input<'ASC' | 'DESC'>('ASC');
  readonly create = output();
  /** Row actions, with the ID of the group they apply to. */
  readonly action = output<ListActionRequest<GroupActionId>>();
  readonly retry = output();
  readonly pageChange = output<{ page: number; pageSize: number }>();
  readonly sortChange = output<'ASC' | 'DESC'>();

  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  private readonly catalog = computed(() => settingsText(this.language()));
  protected readonly eyebrow = computed(() => this.catalog().eyebrow);
  protected readonly text = computed(() => this.catalog().groups);
  protected readonly guidance = computed(() => (this.language() === 'bg' ? bg : en).guidance);
  protected readonly tableMinWidth = '36.25rem';
  protected readonly sortFields = computed(() => [{ field: 'name', label: this.text().name }]);
  protected readonly sortQuery = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: 'name',
    direction: this.sortDirection() === 'ASC' ? 'asc' : 'desc',
  }));
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'name',
      label: this.text().name,
      width: '23rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'vehicles',
      label: this.text().vehicles,
      width: '10rem',
      kind: 'number',
      className: 'app-cell-number',
    },
    {
      id: 'actions',
      label: this.text().actionsColumn,
      width: '3.25rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  /** The list's actions for the row menu; the list has no selection, so none is bulk. */
  protected readonly actions = computed<readonly ListAction<GroupActionId, GroupRow>[]>(() => {
    const text = this.text().actions;
    return [
      { id: 'edit', label: text.edit, appliesTo: () => this.canEdit() },
      {
        id: 'delete',
        label: text.delete,
        danger: true,
        confirm: text.confirmDelete,
        appliesTo: (row) => this.canEdit() && row.vehicles === 0,
      },
    ];
  });
  private readonly records = computed(
    () => new Map(this.rows().map((row) => [row.id, this.toRecord(row)])),
  );
  protected readonly trackById = trackById;
  /** PrimeNG's table takes a mutable array. */
  protected readonly tableRows = computed(() => [...this.rows()]);

  protected editLabel(row: GroupRow): string {
    return interpolate(this.text().edit, { name: row.name });
  }

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    this.sortChange.emit(sort.direction === 'asc' ? 'ASC' : 'DESC');
  }

  protected sort(event: TableLazyLoadEvent): void {
    if (this.sortReady() && (event.sortOrder === 1 || event.sortOrder === -1)) {
      const direction = event.sortOrder === 1 ? 'ASC' : 'DESC';
      if (direction !== this.sortDirection()) {
        this.sortChange.emit(direction);
      }
    }
  }

  protected recordOf(row: GroupRow): ListRecord<GroupActionId> {
    return this.records().get(row.id) ?? this.toRecord(row);
  }

  private toRecord(row: GroupRow): ListRecord<GroupActionId> {
    return listRecord(this.actions(), row, row.id, row.name);
  }
}
