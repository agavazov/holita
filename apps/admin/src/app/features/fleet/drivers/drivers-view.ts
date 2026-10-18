import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '../../../theme/status-tones';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import { FormatDateOnlyPipe, FormatNumberPipe } from '../../../ui/format/format.pipes';
import { formatNumber } from '../../../ui/format/format';
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
import { driversText } from './i18n/messages';

export const driverStatuses = ['ACTIVE', 'ON_LEAVE', 'INACTIVE'] as const;
export type DriverStatusCode = (typeof driverStatuses)[number];

/** One list row, as the Drivers list query returns it. */
export interface DriverRow {
  readonly id: string;
  readonly name: string;
  readonly employeeNo: string;
  readonly status: DriverStatusCode;
  readonly phone: string;
  readonly vehiclePlate: string | null;
  readonly licenseExpiresOn: string;
  readonly tachoCardExpiresOn: string;
  readonly score: number | null;
  readonly trips30d: number;
  readonly distance30dKm: number;
  readonly notes: string;
}

export interface DriverKpis {
  readonly active: number;
  readonly onLeave: number;
  readonly documents: number;
  readonly averageScore: number | null;
  readonly distanceKm: number;
}

/** Documents due within this many days are flagged. */
export const documentWarningDays = 60;

const statusTones: Record<DriverStatusCode, StatusTone> = {
  ACTIVE: 'success',
  ON_LEAVE: 'info',
  INACTIVE: 'neutral',
};

/** Days from the data clock to a date-only expiry (negative when it has passed). */
export function daysUntil(dateOnly: string, asOf: string): number {
  return Math.floor((Date.parse(`${dateOnly}T00:00:00Z`) - Date.parse(asOf)) / 86_400_000);
}

/** The score bands: good, fair and poor driving. */
export function scoreTone(score: number): StatusTone {
  return score >= 85 ? 'success' : score >= 70 ? 'warn' : 'danger';
}

/**
 * The Drivers list page: header, KPIs, quick search and filters, and the table with document
 * expiry, score and row actions. A row opens the driver read-only; Edit switches the drawer to
 * the form. Presentation only: the host owns data, list state and editing.
 */
@Component({
  selector: 'holita-drivers-view',
  imports: [
    ButtonDirective,
    TableModule,
    Tag,
    FilterBuilder,
    FormatDateOnlyPipe,
    FormatNumberPipe,
    KpiStrip,
    KpiTile,
    PageHeader,
    RowActions,
    TablePanel,
  ],
  templateUrl: './drivers-view.html',
  styleUrl: './drivers-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-page' },
})
export class DriversView {
  readonly branchName = input.required<string>();
  readonly dataAsOf = input.required<string>();
  readonly rows = input.required<readonly DriverRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly kpis = input<DriverKpis | null>(null);
  readonly selection = input<readonly string[]>([]);
  readonly notice = input<TableNotice | null>(null);
  readonly stateChange = output<ListQuery>();
  readonly create = output();
  readonly open = output<string>();
  readonly rowAction = output<{ readonly action: string; readonly id: string }>();
  readonly selectionChange = output<readonly string[]>();
  readonly bulkAction = output<string>();
  readonly retry = output();
  readonly dismissNotice = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => driversText(this.language()));
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
        options: driverStatuses.map((value) => ({ value, label: text.statuses[value] })),
      },
      {
        key: 'score',
        label: text.filters.score,
        type: 'number',
        operators: ['lt', 'gt', 'between', 'isEmpty'],
      },
      {
        key: 'license',
        label: text.filters.license,
        type: 'date',
        operators: ['before', 'after', 'between'],
      },
      {
        key: 'tachoCard',
        label: text.filters.tachoCard,
        type: 'date',
        operators: ['before', 'after', 'between'],
      },
      {
        key: 'hasVehicle',
        label: text.filters.hasVehicle,
        type: 'boolean',
        operators: ['isTrue', 'isFalse'],
      },
      { key: 'trips', label: text.filters.trips, type: 'number', operators: ['gt', 'lt'] },
    ];
  });
  protected readonly actions = computed<readonly RowAction[]>(() => [
    { id: 'view', label: this.text().rowActions.view },
    { id: 'edit', label: this.text().rowActions.edit },
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
  protected readonly scoreValue = computed(() => {
    const score = this.kpis()?.averageScore;
    return score === null || score === undefined ? '—' : formatNumber(score, this.language());
  });

  protected statusSeverity(status: DriverStatusCode) {
    return toneSeverity(statusTones[status]);
  }

  protected statusLabel(status: DriverStatusCode): string {
    return this.text().statuses[status];
  }

  /** The tag beside a document date: expired, or due within the warning window. */
  protected expiry(dateOnly: string): { severity: 'danger' | 'warn'; label: string } | null {
    const days = daysUntil(dateOnly, this.dataAsOf());
    if (days < 0) return { severity: 'danger', label: this.text().expiry.expired };
    if (days <= documentWarningDays)
      return { severity: 'warn', label: interpolate(this.text().expiry.soon, { days }) };
    return null;
  }

  protected scoreClass(score: number): string {
    return `app-meter app-meter--${scoreTone(score)}`;
  }

  protected label(template: string, name: string): string {
    return interpolate(template, { name });
  }

  protected onLeave(count: number): string {
    return interpolate(this.text().kpis.onLeave, { count });
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

  protected select(rows: readonly DriverRow[] | null): void {
    this.selectionChange.emit((rows ?? []).map((row) => row.id));
  }
}
