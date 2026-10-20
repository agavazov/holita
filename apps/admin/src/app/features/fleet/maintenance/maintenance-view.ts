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
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { ListSortMenu, type ListSortField } from '../../../ui/list/list-sort-menu';
import { maintenanceText } from './i18n/messages';
import { vehiclesText } from '../vehicles/i18n/messages';
import { vehicleStatuses } from '../vehicles/vehicles-view';
import {
  serviceUrgencies,
  type ServiceTaskRow,
  urgencyTones,
  serviceStatusTones,
  serviceStatuses,
  serviceTypes,
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

export type MaintenanceActionId = 'view' | 'edit' | 'complete' | 'cancel' | 'vehicle' | 'delete';

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
    ListSortMenu,
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
  readonly busy = input(false);
  readonly searchError = input<string | null>(null);
  readonly errorText = input<string | null>(null);
  readonly stateChange = output<ListQuery>();
  readonly create = output();
  /** Row and bulk actions alike, with the IDs they apply to. */
  readonly action = output<ListActionRequest<MaintenanceActionId>>();
  readonly selectionChange = output<readonly ListRecord<MaintenanceActionId>[]>();
  readonly retry = output();

  protected readonly units = injectFleetFormat();
  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => {
    const text = maintenanceText(this.language());
    return {
      ...text,
      kpis: {
        ...text.kpis,
        dueSoonFootnote: interpolate(text.kpis.dueSoonFootnote, {
          distance: this.units.distance(1500, true, 0),
        }),
      },
    };
  });
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
        maxValues: 100,
      },
      {
        key: 'vehicle',
        label: text.filters.vehicle,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: this.vehicles().map((vehicle) => ({ value: vehicle.id, label: vehicle.name })),
        maxValues: 100,
      },
      {
        key: 'status',
        label: text.filters.status,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: serviceStatuses.map((value) => ({ value, label: text.statuses[value] })),
        maxValues: 100,
      },
      {
        key: 'serviceType',
        label: text.drawer.serviceType,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: serviceTypes.map((value) => ({ value, label: text.serviceTypes[value] })),
        maxValues: 100,
      },
      {
        key: 'vehicleStatus',
        label: text.filters.vehicleStatus,
        type: 'enum',
        operators: ['isAnyOf'],
        options: vehicleStatuses.map((value) => ({
          value,
          label: vehiclesText(this.language()).statuses[value],
        })),
        maxValues: 100,
      },
      {
        key: 'task',
        label: text.filters.task,
        type: 'text',
        operators: ['contains', 'equals'],
        maxLength: 120,
      },
      {
        key: 'dueOn',
        label: text.filters.dueOn,
        type: 'date',
        operators: ['on', 'before', 'after', 'between', 'isEmpty'],
      },
      {
        key: 'completedOn',
        label: text.table.completedOn,
        type: 'date',
        operators: ['on', 'before', 'after', 'between'],
      },
      {
        key: 'cost',
        label: text.filters.cost,
        type: 'number',
        operators: ['gt', 'lt', 'isEmpty'],
        min: 0,
        max: 1_000_000,
        decimalPlaces: 2,
      },
    ];
  });
  protected readonly sortFields = computed<readonly ListSortField[]>(() => {
    const text = this.text();
    return [
      { field: 'urgency', label: text.table.urgency },
      { field: 'dueOn', label: text.filters.dueOn },
      { field: 'completedOn', label: text.table.completedOn },
      { field: 'createdAt', label: text.table.createdAt },
      { field: 'task', label: text.table.task },
      { field: 'vehicle', label: text.table.vehicle },
      { field: 'cost', label: text.table.cost },
    ];
  });
  /**
   * Completion opens a per-record form; only deletion is a quick bulk action.
   */
  protected readonly actions = computed<readonly ListAction<MaintenanceActionId, ServiceTaskRow>[]>(
    () => {
      const text = this.text().actions;
      return [
        { id: 'view', label: text.view, appliesTo: (row) => row.status !== 'PLANNED' },
        { id: 'edit', label: text.edit, appliesTo: (row) => row.status === 'PLANNED' },
        {
          id: 'complete',
          label: text.complete,
          appliesTo: (row) => row.status === 'PLANNED',
        },
        {
          id: 'cancel',
          label: text.cancel,
          bulk: true,
          appliesTo: (row) => row.status === 'PLANNED',
        },
        { id: 'vehicle', label: text.vehicle },
        {
          id: 'delete',
          label: text.delete,
          bulk: true,
          danger: true,
          confirm: text.confirmDelete,
          appliesTo: (row) => row.status !== 'DONE',
        },
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

  protected urgencySeverity(task: ServiceTaskRow) {
    return toneSeverity(
      task.urgency ? urgencyTones[task.urgency] : serviceStatusTones[task.status],
    );
  }

  protected urgencyLabel(task: ServiceTaskRow): string {
    return task.urgency ? this.text().urgencies[task.urgency] : this.text().statuses[task.status];
  }

  /** "1,200 km left" or "300 km over" against the current odometer. */
  protected kmLeftLabel(task: ServiceTaskRow): string | null {
    if (task.kmLeft === null || task.status !== 'PLANNED') {
      return null;
    }
    const km = this.units.distance(Math.abs(task.kmLeft), false, 0);
    return interpolate(task.kmLeft < 0 ? this.text().table.kmOver : this.text().table.kmLeft, {
      km,
      unit: this.units.distanceUnit(),
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

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    if (
      this.state().sort?.field === sort.field &&
      this.state().sort?.direction === sort.direction
    ) {
      return;
    }
    this.changeQuery({ ...this.state(), sort, page: 1 });
  }

  protected clearFilters(): void {
    this.changeQuery(listQuery.cleared(this.state()));
  }

  protected sort(event: TableLazyLoadEvent): void {
    if (!this.sortReady()) {
      return;
    }
    const next = listQuery.sorted(this.state(), event);
    if (next) {
      this.changeQuery(next);
    }
  }

  protected select(rows: readonly ServiceTaskRow[] | null): void {
    this.selectionChange.emit((rows ?? []).slice(0, 100).map((row) => this.recordOf(row)));
  }

  /** The selection belongs to the rows on screen, so any new query clears it. */
  private changeQuery(query: ListQuery): void {
    this.stateChange.emit(query);
    if (this.selection().length) {
      this.selectionChange.emit([]);
    }
  }

  private toRecord(row: ServiceTaskRow): ListRecord<MaintenanceActionId> {
    return listRecord(this.actions(), row, row.id, this.label(this.text().table.record, row));
  }
}
