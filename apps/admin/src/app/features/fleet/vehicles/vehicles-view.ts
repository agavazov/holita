import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '../../../theme/status-tones';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import { FormatNumberPipe, FormatRelativePipe } from '../../../ui/format/format.pipes';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import {
  type ListAction,
  type ListActionRequest,
  type ListRecord,
  listRecord,
  trackById,
} from '../../../ui/list/list-actions';
import { injectSortReady, listQuery, type ListQuery } from '../../../ui/list/list-query';
import { ListSortMenu, type ListSortField } from '../../../ui/list/list-sort-menu';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { vehiclesText } from './i18n/messages';

export const vehicleStatuses = ['ACTIVE', 'IN_WORKSHOP', 'INACTIVE'] as const;
export const vehicleActivities = [
  'MOVING',
  'IDLE',
  'PARKED',
  'ASSET',
  'NOT_CONNECTED',
  'NO_DEVICE',
] as const;
export const vehicleTypes = ['TRACTOR', 'RIGID_TRUCK', 'VAN', 'CAR', 'TRAILER', 'OTHER'] as const;
export type VehicleStatusCode = (typeof vehicleStatuses)[number];
export type VehicleActivityCode = (typeof vehicleActivities)[number];
export type VehicleTypeCode = (typeof vehicleTypes)[number];
export type VehicleFuelStatus = 'NORMAL' | 'LOW' | 'STALE' | 'NO_DATA';
export type VehicleActionId = 'edit' | 'profile' | 'deactivate' | 'delete';

/** One list row, as the Vehicles list query returns it. */
export interface VehicleRow {
  readonly id: string;
  readonly plate: string;
  readonly fleetNumber: string | null;
  readonly type: VehicleTypeCode | null;
  readonly make: string;
  readonly model: string;
  readonly year: number | null;
  readonly status: VehicleStatusCode;
  readonly activity: VehicleActivityCode;
  readonly lastReportedAt: string | null;
  readonly location: string | null;
  readonly driverName: string | null;
  readonly group: { readonly name: string; readonly slot: string } | null;
  readonly odometerKm: number | null;
  readonly fuelPct: number | null;
  readonly fuelStatus: VehicleFuelStatus;
  readonly openAlerts: number;
  readonly notes: string;
}

export interface VehicleKpis {
  readonly inOperation: number;
  readonly inWorkshop: number;
  readonly moving: number;
  readonly notReporting: number;
  readonly openAlerts: number;
  readonly lowFuel: number;
}

export interface VehicleOption {
  readonly id: string;
  readonly name: string;
}

const statusTones: Record<VehicleStatusCode, StatusTone> = {
  ACTIVE: 'success',
  IN_WORKSHOP: 'warn',
  INACTIVE: 'neutral',
};

const activityTones: Record<VehicleActivityCode, string> = {
  MOVING: 'success',
  IDLE: 'info',
  PARKED: 'neutral',
  ASSET: 'info',
  NOT_CONNECTED: 'danger',
  NO_DEVICE: 'neutral',
};

/**
 * The Vehicles list page: header, KPI strip, quick search and filter builder, and the table with
 * row actions and bulk actions. Presentation only: the host owns data, list state and editing.
 */
@Component({
  selector: 'holita-vehicles-view',
  imports: [
    ButtonDirective,
    TableModule,
    Tag,
    FilterBuilder,
    FormatNumberPipe,
    FormatRelativePipe,
    KpiStrip,
    KpiTile,
    PageHeader,
    RowActions,
    TablePanel,
    ListSortMenu,
  ],
  templateUrl: './vehicles-view.html',
  styleUrl: './vehicles-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class VehiclesView {
  readonly branchName = input.required<string>();
  /** The instant the telemetry columns refer to (the data clock). */
  readonly dataAsOf = input.required<string>();
  readonly rows = input.required<readonly VehicleRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly kpis = input<VehicleKpis | null>(null);
  readonly groups = input<readonly VehicleOption[]>([]);
  readonly drivers = input<readonly VehicleOption[]>([]);
  readonly selection = input<readonly ListRecord<VehicleActionId>[]>([]);
  readonly busy = input(false);
  readonly profileEnabled = input(true);
  readonly searchError = input<string | null>(null);
  readonly errorText = input<string | null>(null);
  readonly stateChange = output<ListQuery>();
  readonly create = output();
  /** Row and bulk actions alike, with the IDs they apply to. */
  readonly action = output<ListActionRequest<VehicleActionId>>();
  readonly selectionChange = output<readonly ListRecord<VehicleActionId>[]>();
  readonly retry = output();

  protected readonly units = injectFleetFormat();
  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => {
    const text = vehiclesText(this.language());
    return {
      ...text,
      kpis: {
        ...text.kpis,
        notReportingFootnote: interpolate(text.kpis.notReportingFootnote, {
          hours: this.units.preferences().notReportingHours,
        }),
        lowFuelFootnote: interpolate(text.kpis.lowFuelFootnote, {
          percent: this.units.preferences().lowFuelPct,
        }),
      },
      table: {
        ...text.table,
        odometer: interpolate(text.table.odometer, { unit: this.units.distanceUnit() }),
      },
    };
  });
  protected readonly description = computed(() =>
    interpolate(this.text().description, {
      branch: this.branchName(),
      asOf: formatDateTime(this.dataAsOf(), this.language(), this.units.preferences().timeZone),
    }),
  );
  protected readonly fields = computed<readonly FilterField[]>(() => {
    const text = this.text();
    const options = <T extends string>(codes: readonly T[], labels: Record<T, string>) =>
      codes.map((value) => ({ value, label: labels[value] }));
    return [
      {
        key: 'status',
        label: text.filters.status,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: options(vehicleStatuses, text.statuses),
        maxValues: 100,
      },
      {
        key: 'activity',
        label: text.filters.activity,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: options(vehicleActivities, text.activities),
        maxValues: 100,
      },
      {
        key: 'group',
        label: text.filters.group,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf', 'isEmpty'],
        options: this.groups().map((group) => ({ value: group.id, label: group.name })),
        maxValues: 100,
      },
      {
        key: 'type',
        label: text.filters.type,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: options(vehicleTypes, text.types),
        maxValues: 100,
      },
      {
        key: 'make',
        label: text.filters.make,
        type: 'text',
        operators: ['contains', 'equals'],
        maxLength: 64,
      },
      {
        key: 'odometer',
        label: text.filters.odometer,
        type: 'number',
        unit: 'km',
        operators: ['gt', 'lt', 'between'],
        min: 0,
        max: 10_000_000,
      },
      {
        key: 'year',
        label: text.filters.year,
        type: 'number',
        operators: ['equals', 'gt', 'lt', 'between'],
        min: 1950,
        max: 2100,
        integer: true,
      },
      {
        key: 'hasDriver',
        label: text.filters.hasDriver,
        type: 'boolean',
        operators: ['isTrue', 'isFalse'],
      },
      {
        key: 'fuelType',
        label: text.drawer.fuelType,
        type: 'enum',
        operators: ['isAnyOf'],
        options: Object.entries(text.fuelTypes).map(([value, label]) => ({ value, label })),
        maxValues: 100,
      },
      {
        key: 'driver',
        label: text.table.driver,
        type: 'enum',
        operators: ['isAnyOf'],
        options: this.drivers().map((driver) => ({ value: driver.id, label: driver.name })),
        maxValues: 100,
      },
      {
        key: 'hasDevice',
        label: text.filters.hasDevice,
        type: 'boolean',
        operators: ['isTrue', 'isFalse'],
      },
      {
        key: 'hasOpenAlerts',
        label: text.filters.hasOpenAlerts,
        type: 'boolean',
        operators: ['isTrue', 'isFalse'],
      },
      {
        key: 'createdAt',
        label: text.filters.createdAt,
        type: 'date',
        operators: ['after', 'before', 'between'],
      },
    ];
  });
  /** The list's actions, once for the row menu and the bulk bar. */
  protected readonly actions = computed<readonly ListAction<VehicleActionId, VehicleRow>[]>(() => {
    const text = this.text().actions;
    return [
      ...(this.profileEnabled() ? [{ id: 'profile' as const, label: text.profile }] : []),
      { id: 'edit', label: text.edit },
      {
        id: 'deactivate',
        label: text.deactivate,
        bulk: true,
        appliesTo: (row) => row.status !== 'INACTIVE',
      },
      { id: 'delete', label: text.delete, bulk: true, danger: true, confirm: text.confirmDelete },
    ];
  });
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
  protected readonly sortFields = computed<readonly ListSortField[]>(() => {
    const text = this.text();
    return [
      { field: 'plate', label: text.table.plate },
      { field: 'fleetNumber', label: text.drawer.fleetNumber },
      { field: 'status', label: text.table.status },
      { field: 'lastReportedAt', label: text.table.activity },
      { field: 'odometer', label: text.table.odometer },
      { field: 'createdAt', label: text.filters.createdAt },
      { field: 'updatedAt', label: text.table.updatedAt },
    ];
  });
  protected readonly movingShare = computed(() => {
    const kpis = this.kpis();
    if (!kpis || !kpis.inOperation) {
      return null;
    }
    return interpolate(this.text().kpis.movingShare, {
      share: `${formatNumber(Math.round((kpis.moving / kpis.inOperation) * 100), this.language())} %`,
    });
  });

  protected statusSeverity(status: VehicleStatusCode) {
    return toneSeverity(statusTones[status]);
  }

  protected statusLabel(status: VehicleStatusCode): string {
    return this.text().statuses[status];
  }

  protected activityLabel(activity: VehicleActivityCode): string {
    return this.text().activities[activity];
  }

  protected typeLabel(type: VehicleTypeCode | null): string {
    return type === null ? '—' : this.text().types[type];
  }

  protected activityTone(activity: VehicleActivityCode): string {
    return activityTones[activity];
  }

  protected fuelLow(row: VehicleRow): boolean {
    return row.fuelStatus === 'LOW';
  }

  protected label(template: string, plate: string): string {
    return interpolate(template, { plate });
  }

  protected alertsLabel(count: number): string {
    return interpolate(this.text().table.alerts, { count });
  }

  protected inWorkshop(count: number): string {
    return interpolate(this.text().kpis.inWorkshop, { count });
  }

  protected recordOf(row: VehicleRow): ListRecord<VehicleActionId> {
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
    if (!this.sortReady()) {
      return;
    }
    const next = listQuery.sorted(this.state(), event);
    if (next) {
      this.changeQuery(next);
    }
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

  protected select(rows: readonly VehicleRow[] | null): void {
    this.selectionChange.emit((rows ?? []).map((row) => this.recordOf(row)));
  }

  /** The selection belongs to the rows on screen, so any new query clears it. */
  private changeQuery(query: ListQuery): void {
    this.stateChange.emit(query);
    if (this.selection().length) {
      this.selectionChange.emit([]);
    }
  }

  private toRecord(row: VehicleRow): ListRecord<VehicleActionId> {
    return listRecord(this.actions(), row, row.id, row.plate);
  }
}
