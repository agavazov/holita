import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '../../../theme/status-tones';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import {
  displayTimeZone,
  FormatNumberPipe,
  FormatRelativePipe,
} from '../../../ui/format/format.pipes';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions, type RowAction } from '../../../ui/row-actions/row-actions';
import { TablePanel, type TableNotice } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { vehiclesText } from './i18n/messages';

export const vehicleStatuses = ['ACTIVE', 'IN_WORKSHOP', 'INACTIVE'] as const;
export const vehicleActivities = [
  'MOVING',
  'IDLE',
  'PARKED',
  'NOT_CONNECTED',
  'NO_DEVICE',
] as const;
export const vehicleTypes = ['TRACTOR', 'RIGID_TRUCK', 'VAN', 'CAR'] as const;
export type VehicleStatusCode = (typeof vehicleStatuses)[number];
export type VehicleActivityCode = (typeof vehicleActivities)[number];
export type VehicleTypeCode = (typeof vehicleTypes)[number];

/** One list row, as the Vehicles list query returns it. */
export interface VehicleRow {
  readonly id: string;
  readonly plate: string;
  readonly fleetNumber: string | null;
  readonly type: VehicleTypeCode;
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

export interface VehicleListState {
  readonly search: string;
  readonly conditions: readonly FilterCondition[];
  readonly sort: { readonly field: string; readonly direction: 'asc' | 'desc' } | null;
  readonly page: number;
  readonly pageSize: number;
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
  NOT_CONNECTED: 'danger',
  NO_DEVICE: 'neutral',
};

/** Below this fuel level the meter turns red (the shared low-fuel threshold). */
const lowFuelPercent = 12;

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
  ],
  templateUrl: './vehicles-view.html',
  styleUrl: './vehicles-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehiclesView {
  readonly branchName = input.required<string>();
  /** The instant the telemetry columns refer to (the data clock). */
  readonly dataAsOf = input.required<string>();
  readonly rows = input.required<readonly VehicleRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<VehicleListState>();
  readonly kpis = input<VehicleKpis | null>(null);
  readonly groups = input<readonly VehicleOption[]>([]);
  readonly selection = input<readonly string[]>([]);
  readonly notice = input<TableNotice | null>(null);
  readonly busy = input(false);
  readonly stateChange = output<VehicleListState>();
  readonly create = output();
  readonly edit = output<string>();
  readonly rowAction = output<{ readonly action: string; readonly id: string }>();
  readonly selectionChange = output<readonly string[]>();
  readonly bulkAction = output<string>();
  readonly retry = output();
  readonly dismissNotice = output();

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => vehiclesText(this.language()));
  protected readonly description = computed(() =>
    interpolate(this.text().description, {
      branch: this.branchName(),
      asOf: formatDateTime(this.dataAsOf(), this.language(), displayTimeZone),
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
      },
      {
        key: 'activity',
        label: text.filters.activity,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: options(vehicleActivities, text.activities),
      },
      {
        key: 'group',
        label: text.filters.group,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf', 'isEmpty'],
        options: this.groups().map((group) => ({ value: group.id, label: group.name })),
      },
      {
        key: 'type',
        label: text.filters.type,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: options(vehicleTypes, text.types),
      },
      { key: 'make', label: text.filters.make, type: 'text', operators: ['contains', 'equals'] },
      {
        key: 'odometer',
        label: text.filters.odometer,
        type: 'number',
        unit: 'km',
        operators: ['gt', 'lt', 'between'],
      },
      {
        key: 'year',
        label: text.filters.year,
        type: 'number',
        operators: ['equals', 'gt', 'lt', 'between'],
      },
      {
        key: 'hasDriver',
        label: text.filters.hasDriver,
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
  protected readonly actions = computed<readonly RowAction[]>(() => [
    { id: 'edit', label: this.text().rowActions.edit },
    { id: 'profile', label: this.text().rowActions.profile },
    { id: 'deactivate', label: this.text().rowActions.deactivate },
    { id: 'delete', label: this.text().rowActions.delete, danger: true },
  ]);
  /** PrimeNG's table takes a mutable array. */
  protected readonly tableRows = computed(() => [...this.rows()]);
  protected readonly selectedRows = computed(() =>
    this.rows().filter((row) => this.selection().includes(row.id)),
  );
  protected readonly page = computed(() => ({
    page: this.state().page,
    pageSize: this.state().pageSize,
    total: this.total(),
  }));
  protected readonly sortField = computed(() => this.state().sort?.field ?? null);
  protected readonly sortOrder = computed(() => (this.state().sort?.direction === 'asc' ? 1 : -1));
  protected readonly movingShare = computed(() => {
    const kpis = this.kpis();
    if (!kpis || !kpis.inOperation) return null;
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

  protected typeLabel(type: VehicleTypeCode): string {
    return this.text().types[type];
  }

  protected activityTone(activity: VehicleActivityCode): string {
    return activityTones[activity];
  }

  protected fuelLow(row: VehicleRow): boolean {
    return row.fuelPct !== null && row.fuelPct < lowFuelPercent;
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

  protected changeSearch(search: string): void {
    this.stateChange.emit({ ...this.state(), search, page: 1 });
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    this.stateChange.emit({ ...this.state(), conditions, page: 1 });
  }

  protected changePage(page: { page: number; pageSize: number }): void {
    this.stateChange.emit({ ...this.state(), ...page });
  }

  protected clearFilters(): void {
    this.stateChange.emit({ ...this.state(), search: '', conditions: [], page: 1 });
  }

  protected sort(event: TableLazyLoadEvent): void {
    const field = typeof event.sortField === 'string' ? event.sortField : null;
    if (!field) return;
    const direction = event.sortOrder === 1 ? 'asc' : 'desc';
    const current = this.state().sort;
    if (current?.field === field && current.direction === direction) return;
    this.stateChange.emit({ ...this.state(), sort: { field, direction }, page: 1 });
  }

  protected select(rows: readonly VehicleRow[] | null): void {
    this.selectionChange.emit((rows ?? []).map((row) => row.id));
  }
}
