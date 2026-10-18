import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '../../../theme/status-tones';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import { FormatNumberPipe, FormatRelativePipe } from '../../../ui/format/format.pipes';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { injectSortReady, listQuery, type ListQuery } from '../../../ui/list/list-query';
import { PageHeader } from '../../../ui/page-header/page-header';
import { RowActions, type RowAction } from '../../../ui/row-actions/row-actions';
import { TablePanel, type TableNotice } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { devicesText } from './i18n/messages';

export const deviceStatuses = ['ONLINE', 'OFFLINE', 'IN_STOCK'] as const;
export type DeviceStatusCode = (typeof deviceStatuses)[number];

/** The firmware every device should run; older ones are flagged. */
export const currentFirmware = '03.29.02';

/** One tracker, as the Devices list query returns it. */
export interface DeviceRow {
  readonly id: string;
  readonly imei: string;
  readonly model: string;
  readonly firmware: string;
  readonly simIccid: string;
  readonly vehicleId: string | null;
  readonly plate: string | null;
  readonly status: DeviceStatusCode;
  readonly lastSeenAt: string | null;
  readonly signal: number | null;
  readonly voltage: number | null;
  readonly notes: string;
}

export interface DeviceKpis {
  readonly online: number;
  readonly offline: number;
  readonly stock: number;
  readonly outdated: number;
}

export const deviceStatusTones: Record<DeviceStatusCode, StatusTone> = {
  ONLINE: 'success',
  OFFLINE: 'danger',
  IN_STOCK: 'neutral',
};

/**
 * The Devices list page: connection, installation, signal, voltage and firmware of the trackers;
 * a row opens straight into its form. Presentation only: the host owns data and editing.
 */
@Component({
  selector: 'holita-devices-view',
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
  templateUrl: './devices-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-page' },
})
export class DevicesView {
  readonly branchName = input.required<string>();
  readonly dataAsOf = input.required<string>();
  readonly rows = input.required<readonly DeviceRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly kpis = input<DeviceKpis | null>(null);
  readonly models = input<readonly string[]>([]);
  readonly selection = input<readonly string[]>([]);
  readonly notice = input<TableNotice | null>(null);
  readonly stateChange = output<ListQuery>();
  readonly create = output();
  readonly edit = output<string>();
  readonly rowAction = output<{ readonly action: string; readonly id: string }>();
  readonly selectionChange = output<readonly string[]>();
  readonly bulkAction = output<string>();
  readonly retry = output();
  readonly dismissNotice = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => devicesText(this.language()));
  protected readonly currentFirmware = currentFirmware;
  protected readonly description = computed(() =>
    interpolate(this.text().description, { branch: this.branchName() }),
  );
  protected readonly fields = computed<readonly FilterField[]>(() => {
    const text = this.text();
    return [
      {
        key: 'status',
        label: text.filters.status,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: deviceStatuses.map((value) => ({ value, label: text.statuses[value] })),
      },
      {
        key: 'model',
        label: text.filters.model,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: this.models().map((model) => ({ value: model, label: model })),
      },
      {
        key: 'firmware',
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
  protected readonly rowActions = computed(() => {
    const text = this.text().rowActions;
    return new Map<string, readonly RowAction[]>(
      this.rows().map((row) => [
        row.id,
        [
          { id: 'edit', label: text.edit },
          { id: 'restart', label: text.restart, disabled: row.status !== 'ONLINE' },
          { id: 'vehicle', label: text.vehicle, disabled: row.vehicleId === null },
        ],
      ]),
    );
  });
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

  protected statusSeverity(status: DeviceStatusCode) {
    return toneSeverity(deviceStatusTones[status]);
  }

  protected statusLabel(status: DeviceStatusCode): string {
    return this.text().statuses[status];
  }

  protected signalLabel(bars: number): string {
    return interpolate(this.text().table.signalBars, { bars });
  }

  protected signalClass(bars: number): string {
    return `app-meter app-meter--${bars >= 3 ? 'success' : bars === 2 ? 'warn' : 'danger'}`;
  }

  protected actionsOf(row: DeviceRow): readonly RowAction[] {
    return this.rowActions().get(row.id) ?? [];
  }

  protected label(template: string, row: DeviceRow): string {
    return interpolate(template, { imei: row.imei });
  }

  protected changeSearch(search: string): void {
    this.stateChange.emit(listQuery.search(this.state(), search));
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    this.stateChange.emit(listQuery.conditions(this.state(), conditions));
  }

  protected changePage(page: { page: number; pageSize: number }): void {
    this.stateChange.emit(listQuery.page(this.state(), page));
  }

  protected clearFilters(): void {
    this.stateChange.emit(listQuery.cleared(this.state()));
  }

  protected sort(event: TableLazyLoadEvent): void {
    if (!this.sortReady()) return;
    const next = listQuery.sorted(this.state(), event);
    if (next) this.stateChange.emit(next);
  }

  protected select(rows: readonly DeviceRow[] | null): void {
    this.selectionChange.emit((rows ?? []).map((row) => row.id));
  }
}
