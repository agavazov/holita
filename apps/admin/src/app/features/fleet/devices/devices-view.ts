import { RouterLink } from '@angular/router';
import type { FleetRecordLinks } from '../fleet-record-links';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '../../../theme/status-tones';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import { FormatNumberPipe, FormatRelativePipe } from '../../../ui/format/format.pipes';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
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
import { ListSortMenu, type ListSortField } from '../../../ui/list/list-sort-menu';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { deviceModelLabel, devicesText } from './i18n/messages';

export const deviceStatuses = ['ONLINE', 'OFFLINE', 'IN_STOCK'] as const;
export type DeviceStatusCode = (typeof deviceStatuses)[number];
export type DeviceActionId = 'open' | 'edit' | 'restart' | 'vehicle' | 'delete';

/** The firmware every device should run; older ones are flagged. */
export const currentFirmware = '03.29.02';

/** The unit's connection to holita's device server; 'karma' when it has never connected. */
export type DeviceLive =
  | {
      readonly online: boolean;
      /** PRIMARY when holita serves the unit, MIRROR when it only mirrors Karma's traffic. */
      readonly mode: 'PRIMARY' | 'MIRROR' | null;
      readonly lastFrameAt: string | null;
      readonly alarms: number;
      /** No frame within twice the expected reporting interval. */
      readonly overdue: boolean;
      /** Karma writes to routing parameters 0049–0054 in the last 24 hours. */
      readonly routeWrites: number;
      /** Fleet's routing state; KARMA_BACKUP and SILENT get a badge. */
      readonly routing: 'HOLITA' | 'KARMA_BACKUP' | 'SILENT' | null;
    }
  | 'karma';

/** One tracker, as the Devices list query returns it. */
export interface DeviceRow {
  readonly id: string;
  readonly imei: string;
  readonly model: string;
  readonly serialNumber: string;
  readonly edataModule: string;
  readonly simPhoneNumber: string;
  readonly firmware: string;
  readonly simIccid: string;
  readonly vehicleId: string | null;
  readonly plate: string | null;
  readonly status: DeviceStatusCode;
  readonly lastSeenAt: string | null;
  readonly signal: number | null;
  readonly voltage: number | null;
  readonly notes: string;
  /** Null when the query did not ask for the live state. */
  readonly live: DeviceLive | null;
}

export interface DeviceKpis {
  readonly online: number;
  readonly offline: number;
  readonly stock: number;
  readonly outdated: number | null;
}

export const deviceStatusTones: Record<DeviceStatusCode, StatusTone> = {
  ONLINE: 'success',
  OFFLINE: 'danger',
  IN_STOCK: 'neutral',
};

/**
 * The Devices list page: live holita connection, installation, SIM and firmware of the trackers,
 * with row actions and bulk actions; the primary record action opens its read-only overview. Presentation only: the
 * host owns data and editing.
 */
@Component({
  selector: 'holita-devices-view',
  imports: [
    RouterLink,
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
    ListSortMenu,
    TablePanel,
  ],
  templateUrl: './devices-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class DevicesView {
  readonly recordLinks = input<FleetRecordLinks | null>(null);
  /** The device page route without the record ID and tab. */
  readonly deviceLinkBase = input<readonly string[] | null>(null);
  readonly demo = input(false);
  readonly busy = input(false);
  readonly searchError = input<string | null>(null);
  readonly errorText = input<string | null>(null);
  readonly branchName = input.required<string>();
  readonly dataAsOf = input.required<string>();
  readonly rows = input.required<readonly DeviceRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly kpis = input<DeviceKpis | null>(null);
  readonly models = input<readonly string[]>([]);
  readonly selection = input<readonly ListRecord<DeviceActionId>[]>([]);
  readonly stateChange = output<ListQuery>();
  readonly create = output();
  /** Row and bulk actions alike, with the IDs they apply to. */
  readonly action = output<ListActionRequest<DeviceActionId>>();
  readonly selectionChange = output<readonly ListRecord<DeviceActionId>[]>();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  private readonly units = injectFleetFormat();
  protected modelLabel(model: string): string {
    return deviceModelLabel(this.language(), model);
  }

  protected readonly text = computed(() => {
    const text = devicesText(this.language());
    return {
      ...text,
      kpis: {
        ...text.kpis,
        offlineFootnote: interpolate(text.kpis.offlineFootnote, {
          hours: this.units.preferences().notReportingHours,
        }),
      },
    };
  });
  protected readonly currentFirmware = currentFirmware;
  protected readonly description = computed(() =>
    interpolate(this.text().description, { branch: this.branchName() }),
  );
  protected readonly fields = computed<readonly FilterField[]>(() => {
    const text = this.text();
    return [
      {
        key: 'model',
        maxValues: 100,
        label: text.filters.model,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: this.models().map((model) => ({
          value: model,
          label: deviceModelLabel(this.language(), model),
        })),
      },
      {
        key: 'firmware',
        maxLength: 32,
        label: text.filters.firmware,
        type: 'text',
        operators: ['equals', 'notEquals', 'startsWith'],
      },
      {
        key: 'installed',
        label: text.filters.installed,
        type: 'boolean',
        operators: ['isTrue', 'isFalse'],
      },
    ];
  });
  /** The list's actions, once for the row menu and the bulk bar. */
  protected readonly actions = computed<readonly ListAction<DeviceActionId, DeviceRow>[]>(() => {
    const text = this.text().actions;
    const actions: ListAction<DeviceActionId, DeviceRow>[] = [
      { id: 'open', label: text.open },
      { id: 'edit', label: text.edit },
      {
        id: 'restart',
        label: this.demo() ? text.restart : text.restartUnavailable,
        bulk: true,
        confirm: text.confirmRestart,
        appliesTo: (row) => this.demo() && row.status === 'ONLINE',
      },
      {
        id: 'vehicle',
        label: text.vehicle,
        appliesTo: (row) => row.vehicleId !== null,
      },
    ];
    if (!this.demo()) {
      actions.push({
        id: 'delete',
        label: text.delete,
        bulk: true,
        danger: true,
        confirm: text.confirmDelete,
      });
    }
    return actions;
  });
  private readonly records = computed(
    () => new Map(this.rows().map((row) => [row.id, this.toRecord(row)])),
  );
  protected readonly trackById = trackById;
  /** The reference for "offline since"; the rows were loaded just now. */
  protected readonly now = computed(() => {
    this.rows();
    return Date.now();
  });
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
      { field: 'imei', label: text.drawer.imei },
      { field: 'vehicle', label: text.table.vehicle },
      { field: 'lastSeenAt', label: text.table.lastSeen },
      { field: 'installedAt', label: text.sort.installedAt },
      { field: 'createdAt', label: text.sort.createdAt },
    ];
  });

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    this.changeQuery({ ...this.state(), sort, page: 1 });
  }

  protected lastFrame(relative: string): string {
    return interpolate(this.text().table.lastFrame, { time: relative });
  }

  protected deviceLink(row: DeviceRow): readonly string[] | null {
    const base = this.deviceLinkBase();
    return base ? [...base, row.id, 'overview'] : null;
  }

  protected alarmsLabel(alarms: number): string {
    return interpolate(this.text().table.alarms, { count: alarms });
  }

  protected label(template: string, row: DeviceRow): string {
    return interpolate(template, { imei: row.imei });
  }

  protected recordOf(row: DeviceRow): ListRecord<DeviceActionId> {
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

  protected select(rows: readonly DeviceRow[] | null): void {
    this.selectionChange.emit((rows ?? []).map((row) => this.recordOf(row)));
  }

  /** The selection belongs to the rows on screen, so any new query clears it. */
  private changeQuery(query: ListQuery): void {
    this.stateChange.emit(query);
    if (this.selection().length) {
      this.selectionChange.emit([]);
    }
  }

  private toRecord(row: DeviceRow): ListRecord<DeviceActionId> {
    return listRecord(this.actions(), row, row.id, row.imei);
  }
}
