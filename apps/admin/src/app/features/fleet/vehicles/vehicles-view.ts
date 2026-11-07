import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FleetNow } from '../../../ui/fleet-live/fleet-now';
import { injectFleetNow } from '../../../ui/fleet-live/fleet-clock';
import { FleetLiveSummary } from '../../../ui/fleet-live/fleet-live-summary';
import { fleetLiveText, type FleetLiveDevice } from '../../../ui/fleet-live/fleet-live';
import type { FleetWarning } from '../../../ui/fleet-live/fault-wording';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import { formatNumber, formatRelative } from '../../../ui/format/format';
import { interpolate, uiMessages } from '../../../ui/i18n/messages';
import {
  type ListAction,
  type ListActionRequest,
  type ListRecord,
  listRecord,
  trackById,
} from '../../../ui/list/list-actions';
import { injectSortReady, listQuery, type ListQuery } from '../../../ui/list/list-query';
import { ListSortMenu, type ListSortField } from '../../../ui/list/list-sort-menu';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel, type TableColumn } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { vehiclesText } from './i18n/messages';
import { vehicleLastReport, vehicleLiveDevice, vehicleLiveStatus } from './vehicle-live';
import en from './vehicles-list.en.json';
import bg from './vehicles-list.bg.json';

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
  readonly devices: readonly {
    readonly id: string;
    readonly imei: string;
    readonly lastReportedAt: string | null;
  }[];
  readonly liveDevices?: readonly FleetLiveDevice[];
  readonly currentWarnings: readonly FleetWarning[];
  readonly positionAt?: string | null;
  readonly positionAgeSeconds?: number | null;
  readonly mapAsOf?: string | null;
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

export interface VehicleOption {
  readonly id: string;
  readonly name: string;
}

/**
 * The Vehicles list page: header, KPI strip, quick search and filter builder, and the table with
 * row actions and bulk actions. Presentation only: the host owns data, list state and editing.
 */
@Component({
  selector: 'holita-vehicles-view',
  imports: [
    ButtonDirective,
    TableModule,
    Skeleton,
    Tag,
    FilterBuilder,
    RouterLink,
    FleetNow,
    FleetLiveSummary,
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
  readonly branchId = input('');
  readonly branchName = input.required<string>();
  /** The instant the telemetry columns refer to (the data clock). */
  readonly dataAsOf = input.required<string>();
  readonly rows = input.required<readonly VehicleRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly groups = input<readonly VehicleOption[]>([]);
  readonly drivers = input<readonly VehicleOption[]>([]);
  readonly selection = input<readonly ListRecord<VehicleActionId>[]>([]);
  readonly busy = input(false);
  readonly liveLoading = input(false);
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
  private readonly now = injectFleetNow();
  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => {
    const text = vehiclesText(this.language());
    return {
      ...text,
      table: {
        ...text.table,
        odometer: interpolate(text.table.odometer, { unit: this.units.distanceUnit() }),
      },
    };
  });
  protected readonly description = computed(() =>
    interpolate(this.text().description, {
      branch: this.branchName(),
      asOf: this.units.dateTime(this.dataAsOf()),
    }),
  );
  protected readonly listText = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly tableMinWidth = '83rem';
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'check',
      label: this.text().table.selectPage,
      width: '3rem',
      kind: 'check',
      className: 'app-col-check',
    },
    {
      id: 'vehicle',
      label: this.text().table.vehicle,
      width: '17rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'activity', label: this.listText().activity, width: '20rem', kind: 'status' },
    { id: 'latest', label: this.listText().latest, width: '16rem', kind: 'date' },
    { id: 'problems', label: this.listText().problems, width: '12rem', kind: 'problems' },
    {
      id: 'driver',
      label: this.text().table.driver,
      width: '11rem',
      className: 'app-col-secondary',
    },
    {
      id: 'actions',
      label: this.text().table.actions,
      width: '4rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
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
      { field: 'lastReportedAt', label: text.table.fleetLastReport },
      { field: 'odometer', label: text.table.odometer },
      { field: 'createdAt', label: text.filters.createdAt },
      { field: 'updatedAt', label: text.table.updatedAt },
    ];
  });

  protected readonly liveText = computed(() => fleetLiveText(this.language()));
  protected readonly uiText = computed(() => uiMessages[this.language()]);
  protected readonly liveGroups = computed(() =>
    this.rows().map((row) => row.devices.map((_, index) => row.liveDevices?.[index])),
  );

  protected problemLink(id: string): readonly string[] {
    return ['/', this.language(), this.branchId(), 'fleet', 'vehicles', id, 'problems'];
  }

  protected identity(row: VehicleRow): string {
    return (
      [[row.make, row.model].filter(Boolean).join(' '), row.group?.name]
        .filter(Boolean)
        .join(' · ') || '—'
    );
  }

  protected liveStatus(row: VehicleRow) {
    return vehicleLiveStatus(
      row.devices.map((_, index) => row.liveDevices?.[index]),
      this.language(),
    );
  }

  protected activityDevice(row: VehicleRow): FleetLiveDevice {
    return vehicleLiveDevice(row.liveDevices ?? []);
  }

  protected reportAt(row: VehicleRow): string | null {
    return vehicleLastReport(row.liveDevices ?? []) ?? row.lastReportedAt;
  }

  protected positionAge(row: VehicleRow): string {
    return formatRelative(row.positionAt, this.now(), this.language());
  }

  protected devicesTitle(row: VehicleRow): string {
    return interpolate(this.listText().devices, {
      count: formatNumber(row.devices.length, this.language()),
    });
  }

  protected problemLabel(row: VehicleRow): string {
    return row.currentWarnings.length
      ? interpolate(this.listText().problemCount, {
          count: formatNumber(row.currentWarnings.length, this.language()),
        })
      : this.listText().noProblems;
  }

  protected problemTitle(row: VehicleRow): string {
    return interpolate(this.listText().problemScope, {
      count: formatNumber(row.currentWarnings.length, this.language()),
    });
  }

  protected problemTone(row: VehicleRow) {
    return toneSeverity(
      row.currentWarnings.some((warning) => warning.state === 'RED')
        ? 'danger'
        : row.currentWarnings.some((warning) => warning.state === 'YELLOW')
          ? 'warn'
          : row.currentWarnings.length
            ? 'info'
            : 'neutral',
    );
  }

  protected readonly toneSeverity = toneSeverity;

  protected label(template: string, plate: string): string {
    return interpolate(template, { plate });
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
