import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { FormatNumberPipe } from '../../../ui/format/format.pipes';
import { interpolate } from '../../../ui/i18n/messages';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions, type RowAction } from '../../../ui/row-actions/row-actions';
import { TablePanel, type TableNotice } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { settingsText } from './i18n/messages';

/** One vehicle group with the number of vehicles in it. */
export interface GroupRow {
  readonly id: string;
  readonly name: string;
  readonly slot: string;
  readonly description: string;
  readonly vehicles: number;
}

/**
 * A short settings list: no search, filters or paging, every row on one page; a row opens
 * straight into its form. Groups that still have vehicles cannot be deleted.
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
  readonly notice = input<TableNotice | null>(null);
  readonly create = output();
  readonly edit = output<string>();
  readonly remove = output<string>();
  readonly retry = output();
  readonly dismissNotice = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly catalog = computed(() => settingsText(this.language()));
  protected readonly eyebrow = computed(() => this.catalog().eyebrow);
  protected readonly text = computed(() => this.catalog().groups);
  protected readonly rowActions = computed(() => {
    const text = this.text();
    return new Map<string, readonly RowAction[]>(
      this.rows().map((row) => [
        row.id,
        [
          { id: 'edit', label: text.editAction },
          { id: 'delete', label: text.deleteAction, danger: true, disabled: row.vehicles > 0 },
        ],
      ]),
    );
  });
  /** PrimeNG's table takes a mutable array. */
  protected readonly tableRows = computed(() => [...this.rows()]);

  protected actionsOf(row: GroupRow): readonly RowAction[] {
    return this.rowActions().get(row.id) ?? [];
  }

  protected editLabel(row: GroupRow): string {
    return interpolate(this.text().edit, { name: row.name });
  }

  protected act(action: string, id: string): void {
    if (action === 'edit') this.edit.emit(id);
    if (action === 'delete') this.remove.emit(id);
  }
}
