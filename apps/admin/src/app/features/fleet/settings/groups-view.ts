import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { FormatNumberPipe } from '../../../ui/format/format.pipes';
import { interpolate } from '../../../ui/i18n/messages';
import {
  type ListAction,
  type ListActionRequest,
  type ListRecord,
  listRecord,
  trackById,
} from '../../../ui/list/list-actions';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { settingsText } from './i18n/messages';

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
 * A short settings list: no search, filters, selection or paging, every row on one page; a row
 * opens straight into its form. Groups that still have vehicles cannot be deleted.
 */
@Component({
  selector: 'holita-groups-view',
  imports: [ButtonDirective, TableModule, FormatNumberPipe, PageHeader, RowActions, TablePanel],
  templateUrl: './groups-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class GroupsView {
  readonly rows = input.required<readonly GroupRow[]>();
  readonly view = input.required<TableView>();
  readonly create = output();
  /** Row actions, with the ID of the group they apply to. */
  readonly action = output<ListActionRequest<GroupActionId>>();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly catalog = computed(() => settingsText(this.language()));
  protected readonly eyebrow = computed(() => this.catalog().eyebrow);
  protected readonly text = computed(() => this.catalog().groups);
  /** The list's actions for the row menu; the list has no selection, so none is bulk. */
  protected readonly actions = computed<readonly ListAction<GroupActionId, GroupRow>[]>(() => {
    const text = this.text().actions;
    return [
      { id: 'edit', label: text.edit },
      {
        id: 'delete',
        label: text.delete,
        danger: true,
        confirm: text.confirmDelete,
        appliesTo: (row) => row.vehicles === 0,
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

  protected recordOf(row: GroupRow): ListRecord<GroupActionId> {
    return this.records().get(row.id) ?? this.toRecord(row);
  }

  private toRecord(row: GroupRow): ListRecord<GroupActionId> {
    return listRecord(this.actions(), row, row.id, row.name);
  }
}
