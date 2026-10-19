import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import {
  FormatDateOnlyPipe,
  FormatMoneyPipe,
  FormatNumberPipe,
} from '../../../ui/format/format.pipes';
import { formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import {
  type ListAction,
  type ListActionRequest,
  type ListRecord,
  listRecord,
  trackById,
} from '../../../ui/list/list-actions';
import { injectSortReady, listQuery, type ListQuery } from '../../../ui/list/list-query';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { maintenanceText } from './i18n/messages';
import {
  serviceUrgencies,
  type ServiceTaskRow,
  type ServiceUrgency,
  urgencyTones,
} from './service-task';

export interface MaintenanceKpis {
  readonly overdue: number;
  readonly dueSoon: number;
  readonly planned: number;
  readonly costCents: number;
}

export interface MaintenanceOption {
  readonly id: string;
  readonly name: string;
}

export type MaintenanceActionId = 'edit' | 'complete' | 'vehicle' | 'delete';

/**
 * The Maintenance list page: service tasks due by date and/or odometer with urgency, cost and
 * row and bulk actions. A row opens straight into its form. Presentation only: the host owns
 * data, list state and editing.
 */
@Component({
  selector: 'holita-maintenance-view',
  imports: [
    ButtonDirective,
    TableModule,
    Tag,
    FilterBuilder,
    FormatDateOnlyPipe,
    FormatMoneyPipe,
    FormatNumberPipe,
    KpiStrip,
    KpiTile,
    PageHeader,
    RowActions,
    TablePanel,
  ],
  templateUrl: './maintenance-view.html',
  styleUrl: './maintenance-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class MaintenanceView {
  readonly branchName = input.required<string>();
  readonly rows = input.required<readonly ServiceTaskRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly kpis = input<MaintenanceKpis | null>(null);
  readonly vehicles = input<readonly MaintenanceOption[]>([]);
  readonly selection = input<readonly ListRecord<MaintenanceActionId>[]>([]);
  readonly stateChange = output<ListQuery>();
  readonly create = output();
  /** Row and bulk actions alike, with the IDs they apply to. */
  readonly action = output<ListActionRequest<MaintenanceActionId>>();
  readonly selectionChange = output<readonly ListRecord<MaintenanceActionId>[]>();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => maintenanceText(this.language()));
  protected readonly description = computed(() =>
    interpolate(this.text().description, { branch: this.branchName() }),
  );
  protected readonly fields = computed<readonly FilterField[]>(() => {
    const text = this.text();
    return [
      {
        key: 'urgency',
        label: text.filters.urgency,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: serviceUrgencies.map((value) => ({ value, label: text.urgencies[value] })),
      },
      {
        key: 'vehicle',
        label: text.filters.vehicle,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: this.vehicles().map((vehicle) => ({ value: vehicle.id, label: vehicle.name })),
      },
      { key: 'task', label: text.filters.task, type: 'text', operators: ['contains', 'equals'] },
      {
        key: 'dueOn',
        label: text.filters.dueOn,
        type: 'date',
        operators: ['before', 'after', 'between', 'isEmpty'],
      },
      {
        key: 'cost',
        label: text.filters.cost,
        type: 'number',
        operators: ['gt', 'lt', 'isEmpty'],
      },
    ];
  });
  /**
   * The list's actions, once for the row menu and the bulk bar. Mark as done applies only to
   * open tasks.
   */
  protected readonly actions = computed<readonly ListAction<MaintenanceActionId, ServiceTaskRow>[]>(
    () => {
      const text = this.text().actions;
      return [
        { id: 'edit', label: text.edit },
        {
          id: 'complete',
          label: text.complete,
          bulk: true,
          appliesTo: (row) => row.urgency !== 'DONE',
        },
        { id: 'vehicle', label: text.vehicle },
        { id: 'delete', label: text.delete, bulk: true, danger: true, confirm: text.confirmDelete },
      ];
    },
  );
  private readonly records = computed(
    () => new Map(this.rows().map((row) => [row.id, this.toRecord(row)])),
  );
  protected readonly trackById = trackById;
  /** PrimeNG's table takes a mutable array. */
  protected readonly tableRows = computed(() => [...this.rows()]);
  protected readonly selectedRows = computed(() => {
    const selected = new Set(this.selection().map((record) => record.id));
    return this.rows().filter((row) => selected.has(row.id));
  });
  /** The selected rows as they are now, so the bulk bar and its question use current rules. */
  protected readonly selectedRecords = computed(() =>
    this.selectedRows().map((row) => this.recordOf(row)),
  );
  protected readonly page = computed(() => ({
    page: this.state().page,
    pageSize: this.state().pageSize,
    total: this.total(),
  }));
  protected readonly sortField = computed(() => this.state().sort?.field ?? null);
  protected readonly sortOrder = computed(() => (this.state().sort?.direction === 'asc' ? 1 : -1));

  protected urgencySeverity(urgency: ServiceUrgency) {
    return toneSeverity(urgencyTones[urgency]);
  }

  protected urgencyLabel(urgency: ServiceUrgency): string {
    return this.text().urgencies[urgency];
  }

  /** "1,200 km left" or "300 km over" against the current odometer. */
  protected kmLeftLabel(task: ServiceTaskRow): string | null {
    if (task.kmLeft === null || task.urgency === 'DONE') return null;
    const km = formatNumber(Math.abs(task.kmLeft), this.language());
    return interpolate(task.kmLeft < 0 ? this.text().table.kmOver : this.text().table.kmLeft, {
      km,
    });
  }

  protected label(template: string, row: ServiceTaskRow): string {
    return interpolate(template, { task: row.kind, plate: row.plate });
  }

  protected recordOf(row: ServiceTaskRow): ListRecord<MaintenanceActionId> {
    return this.records().get(row.id) ?? this.toRecord(row);
  }

  protected changeSearch(search: string): void {
    this.changeQuery(listQuery.search(this.state(), search));
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    this.changeQuery(listQuery.conditions(this.state(), conditions));
  }

  protected changePage(page: { page: number; pageSize: number }): void {
    this.changeQuery(listQuery.page(this.state(), page));
  }

  protected clearFilters(): void {
    this.changeQuery(listQuery.cleared(this.state()));
  }

  protected sort(event: TableLazyLoadEvent): void {
    if (!this.sortReady()) return;
    const next = listQuery.sorted(this.state(), event);
    if (next) this.changeQuery(next);
  }

  protected select(rows: readonly ServiceTaskRow[] | null): void {
    this.selectionChange.emit((rows ?? []).map((row) => this.recordOf(row)));
  }

  /** The selection belongs to the rows on screen, so any new query clears it. */
  private changeQuery(query: ListQuery): void {
    this.stateChange.emit(query);
    if (this.selection().length) this.selectionChange.emit([]);
  }

  private toRecord(row: ServiceTaskRow): ListRecord<MaintenanceActionId> {
    return listRecord(this.actions(), row, row.id, this.label(this.text().table.record, row));
  }
}
