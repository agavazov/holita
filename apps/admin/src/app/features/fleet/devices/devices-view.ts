import { RouterLink } from '@angular/router';
import type { FleetRecordLinks } from '../fleet-record-links';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Skeleton } from 'primeng/skeleton';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
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
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { deviceModelLabel, devicesText } from './i18n/messages';
import { FleetFaults } from '../../../ui/fleet-live/fleet-faults';
import { fleetLiveText } from '../../../ui/fleet-live/fleet-live';
import { Tag } from 'primeng/tag';
import type {
  AdminDeviceDetailsFragment,
  AdminDevicesLiveQuery,
} from '../../../../generated/graphql/operations';
import { formatNumber, formatRelative } from '../../../ui/format/format';
import { injectFleetNow } from '../../../ui/fleet-live/fleet-clock';
import { toneSeverity, type StatusTone } from '../../../ui/tones';
import { injectFleetFormat } from '../../../ui/format/fleet-format';

export const deviceStatuses = ['ONLINE', 'OFFLINE', 'IN_STOCK'] as const;
export type DeviceStatusCode = (typeof deviceStatuses)[number];
export type DeviceActionId = 'open' | 'edit' | 'vehicle' | 'delete';

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
  readonly notes: string;
  /** Undefined while live state is unavailable. */
  readonly live: AdminDevicesLiveQuery['fleetDevices']['items'][number] | undefined;
  readonly warningLamps: AdminDeviceDetailsFragment['warningLamps'];
}

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
    Skeleton,
    FilterBuilder,
    Tag,
    FleetFaults,
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
  readonly busy = input(false);
  readonly liveLoading = input(false);
  readonly searchError = input<string | null>(null);
  readonly errorText = input<string | null>(null);
  readonly branchName = input.required<string>();
  readonly rows = input.required<readonly DeviceRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly models = input<readonly string[]>([]);
  readonly selection = input<readonly ListRecord<DeviceActionId>[]>([]);
  readonly stateChange = output<ListQuery>();
  readonly create = output();
  /** Row and bulk actions alike, with the IDs they apply to. */
  readonly action = output<ListActionRequest<DeviceActionId>>();
  readonly selectionChange = output<readonly ListRecord<DeviceActionId>[]>();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly format = injectFleetFormat();
  private readonly now = injectFleetNow();
  protected readonly toneSeverity = toneSeverity;
  private readonly sortReady = injectSortReady();
  protected modelLabel(model: string): string {
    return deviceModelLabel(this.language(), model);
  }
  protected readonly text = computed(() => devicesText(this.language()));
  protected readonly liveText = computed(() => fleetLiveText(this.language()));
  protected readonly uiText = computed(() => uiMessages[this.language()]);
  protected readonly tableMinWidth = '79rem';
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'select',
      label: this.text().table.selectPage,
      width: '3rem',
      kind: 'check',
      className: 'app-col-check',
    },
    {
      id: 'device',
      label: this.text().table.device,
      width: '17rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'connection', label: this.liveText().connection, width: '12rem', kind: 'status' },
    { id: 'lastReport', label: this.text().status.lastSignal, width: '11rem', kind: 'date' },
    { id: 'routing', label: this.text().status.routing, width: '13rem', kind: 'status' },
    { id: 'lamps', label: this.text().status.warningLamps, width: '10rem', kind: 'status' },
    { id: 'problems', label: this.text().table.problems, width: '10rem', kind: 'problems' },
    {
      id: 'actions',
      label: this.text().table.actions,
      width: '3rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  protected readonly withoutTruck = computed(() =>
    this.state().conditions.some(
      (condition) => condition.field === 'installed' && condition.operator === 'isFalse',
    ),
  );
  protected toggleWithoutTruck(): void {
    const conditions = this.state().conditions.filter(
      (condition) => condition.field !== 'installed',
    );
    this.changeConditions(
      this.withoutTruck()
        ? conditions
        : [
            ...conditions,
            { id: 'without-truck', field: 'installed', operator: 'isFalse', values: [] },
          ],
    );
  }
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
        id: 'vehicle',
        label: text.vehicle,
        appliesTo: (row) => row.vehicleId !== null,
      },
    ];
    actions.push({
      id: 'delete',
      label: text.delete,
      bulk: true,
      danger: true,
      confirm: text.confirmDelete,
    });
    return actions;
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
      { field: 'imei', label: text.drawer.imei },
      { field: 'vehicle', label: text.table.vehicle },
      { field: 'lastSeenAt', label: text.sort.fleetLastReport },
      { field: 'installedAt', label: text.sort.installedAt },
      { field: 'createdAt', label: text.sort.createdAt },
    ];
  });

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    this.changeQuery({ ...this.state(), sort, page: 1 });
  }

  protected deviceLink(row: DeviceRow): readonly string[] | null {
    const base = this.deviceLinkBase();
    return base ? [...base, row.id, 'overview'] : null;
  }

  protected diagnosticsLink(row: DeviceRow): readonly string[] | null {
    const base = this.deviceLinkBase();
    return base ? [...base, row.id, 'problems'] : null;
  }

  protected connectionStatus(row: DeviceRow): { label: string; tone: StatusTone } {
    const state = row.live?.ermState;
    const text = this.liveText();
    if (!row.live) {
      return { label: text.unavailable, tone: 'neutral' };
    }
    if (state?.online) {
      return state.lastFrameAt && !state.health.overdue
        ? { label: text.live, tone: 'success' }
        : { label: text.connected, tone: 'info' };
    }
    if (state?.lastFrameAt) {
      return state.health.overdue
        ? { label: this.text().status.offline, tone: 'danger' }
        : { label: this.text().status.reportingOffline, tone: 'warn' };
    }
    return { label: this.text().status.noHolitaConnection, tone: 'neutral' };
  }

  protected lastSignal(row: DeviceRow): { at: string | null; source: string | null } {
    const holita = row.live?.ermState?.lastFrameAt ?? null;
    const karma = row.live?.ermRouting.latestKarmaReportAt ?? null;
    const candidates = [
      { at: holita, source: this.text().status.viaHolita },
      { at: karma, source: this.text().status.viaKarma },
      { at: row.live?.lastReportedAt ?? row.lastSeenAt, source: null },
    ];
    return candidates.reduce<{ at: string | null; source: string | null }>(
      (latest, candidate) =>
        candidate.at && (!latest.at || Date.parse(candidate.at) > Date.parse(latest.at))
          ? candidate
          : latest,
      { at: null, source: null },
    );
  }

  protected reportCell(row: DeviceRow) {
    const at = this.lastSignal(row).at;
    return {
      text: formatRelative(at, this.now(), this.language()),
      title: this.format.dateTimeCell(at, true).title,
    };
  }

  protected backupSince(row: DeviceRow): { text: string; title: string } {
    const at = row.live?.ermRouting.since;
    return {
      text: interpolate(this.text().status.since, { time: this.format.dateTime(at) }),
      title: this.format.dateTimeCell(at, true).title,
    };
  }

  protected lampStatus(row: DeviceRow): { label: string; tone: StatusTone; title: string } {
    const lamps = row.warningLamps;
    const active = lamps.filter(
      (lamp) => lamp.state === 'RED' || lamp.state === 'YELLOW' || lamp.state === 'INFORMATION',
    );
    const reported = lamps.filter(
      (lamp) =>
        lamp.state === 'OFF' ||
        lamp.state === 'RED' ||
        lamp.state === 'YELLOW' ||
        lamp.state === 'INFORMATION',
    ).length;
    return {
      label: reported
        ? interpolate(this.text().status.activeLamps, {
            count: formatNumber(active.length, this.language()),
          })
        : this.text().status.noLampReports,
      tone: active.some((lamp) => lamp.state === 'RED')
        ? 'danger'
        : active.length
          ? 'warn'
          : 'neutral',
      title: interpolate(this.text().status.lampCoverage, { count: reported, total: lamps.length }),
    };
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
