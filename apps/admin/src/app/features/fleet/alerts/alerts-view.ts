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
import { alertsText } from './i18n/messages';

export const alertSeverities = ['CRITICAL', 'WARNING', 'INFO'] as const;
export const alertStatuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type AlertSeverityCode = (typeof alertSeverities)[number];
export type AlertStatusCode = (typeof alertStatuses)[number];

/** One alert, as the Alerts list query returns it (the drawer shows the same record). */
export interface AlertRow {
  readonly id: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly driverName: string | null;
  readonly kind: string;
  readonly detail: string;
  readonly severity: AlertSeverityCode;
  readonly status: AlertStatusCode;
  readonly occurredAt: string;
  readonly remark: string;
}

export interface AlertKpis {
  readonly critical: number;
  readonly open: number;
  readonly acknowledged: number;
  readonly resolved: number;
}

export interface AlertOption {
  readonly id: string;
  readonly name: string;
}

export const severityTones: Record<AlertSeverityCode, StatusTone> = {
  CRITICAL: 'danger',
  WARNING: 'warn',
  INFO: 'info',
};

export const alertStatusTones: Record<AlertStatusCode, StatusTone> = {
  OPEN: 'danger',
  ACKNOWLEDGED: 'warn',
  RESOLVED: 'success',
};

/**
 * The Alerts list page: severity and status tags, the default "not resolved" filter as a chip,
 * row and bulk actions that depend on the status. A row opens the alert in a view drawer with
 * actions. Presentation only: the host owns data, list state and the updates.
 */
@Component({
  selector: 'holita-alerts-view',
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
  templateUrl: './alerts-view.html',
  styleUrl: './alerts-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class AlertsView {
  readonly branchName = input.required<string>();
  readonly dataAsOf = input.required<string>();
  readonly rows = input.required<readonly AlertRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly kpis = input<AlertKpis | null>(null);
  readonly vehicles = input<readonly AlertOption[]>([]);
  readonly selection = input<readonly string[]>([]);
  readonly notice = input<TableNotice | null>(null);
  readonly stateChange = output<ListQuery>();
  readonly open = output<string>();
  readonly rowAction = output<{ readonly action: string; readonly id: string }>();
  readonly selectionChange = output<readonly string[]>();
  readonly bulkAction = output<string>();
  readonly retry = output();
  readonly dismissNotice = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => alertsText(this.language()));
  protected readonly description = computed(() =>
    interpolate(this.text().description, { branch: this.branchName() }),
  );
  protected readonly fields = computed<readonly FilterField[]>(() => {
    const text = this.text();
    return [
      {
        key: 'severity',
        label: text.filters.severity,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: alertSeverities.map((value) => ({ value, label: text.severities[value] })),
      },
      {
        key: 'status',
        label: text.filters.status,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: alertStatuses.map((value) => ({ value, label: text.statuses[value] })),
      },
      {
        key: 'vehicle',
        label: text.filters.vehicle,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: this.vehicles().map((vehicle) => ({ value: vehicle.id, label: vehicle.name })),
      },
      {
        key: 'occurredAt',
        label: text.filters.occurredAt,
        type: 'date',
        operators: ['on', 'after', 'before', 'between'],
      },
    ];
  });
  /** The row menu: Acknowledge only for open alerts, Resolve until resolved. */
  protected readonly rowActions = computed(() => {
    const text = this.text().rowActions;
    return new Map<string, readonly RowAction[]>(
      this.rows().map((row) => [
        row.id,
        [
          { id: 'open', label: text.open },
          { id: 'acknowledge', label: text.acknowledge, disabled: row.status !== 'OPEN' },
          { id: 'resolve', label: text.resolve, disabled: row.status === 'RESOLVED' },
          { id: 'vehicle', label: text.vehicle },
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

  protected severitySeverity(severity: AlertSeverityCode) {
    return toneSeverity(severityTones[severity]);
  }

  protected severityLabel(severity: AlertSeverityCode): string {
    return this.text().severities[severity];
  }

  protected statusSeverity(status: AlertStatusCode) {
    return toneSeverity(alertStatusTones[status]);
  }

  protected statusLabel(status: AlertStatusCode): string {
    return this.text().statuses[status];
  }

  protected actionsOf(row: AlertRow): readonly RowAction[] {
    return this.rowActions().get(row.id) ?? [];
  }

  protected label(template: string, row: AlertRow): string {
    return interpolate(template, { kind: row.kind, plate: row.plate });
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

  protected select(rows: readonly AlertRow[] | null): void {
    this.selectionChange.emit((rows ?? []).map((row) => row.id));
  }
}
