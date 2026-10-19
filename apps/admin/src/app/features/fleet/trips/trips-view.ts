import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { StatusTone } from '../../../theme/status-tones';
import type { FilterCondition, FilterField } from '../../../ui/filter-builder/filter-model';
import { FilterBuilder } from '../../../ui/filter-builder/filter-builder';
import {
  displayTimeZone,
  FormatDateTimePipe,
  FormatDurationPipe,
  FormatNumberPipe,
} from '../../../ui/format/format.pipes';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
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
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { scoreTone } from '../drivers/drivers-view';
import { tripsText } from './i18n/messages';

export type TripActionId = 'open' | 'vehicle';

export interface TripEvent {
  readonly at: string;
  readonly kind: string;
  readonly detail: string;
  readonly tone: 'info' | 'warn' | 'danger';
}

/** One trip, as the Trips list query returns it (the drawer shows the same record). */
export interface TripRow {
  readonly id: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly driverName: string | null;
  readonly driverId?: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly distanceKm: number | null;
  readonly durationMin: number | null;
  readonly maxSpeedKph: number | null;
  readonly inProgress?: boolean;
  readonly fuelUsedL: number | null;
  readonly score: number | null;
  readonly events: readonly TripEvent[];
}

export interface TripKpis {
  readonly trips: number;
  readonly distanceKm: number;
  readonly drivingMin: number;
  readonly averageScore: number | null;
  readonly events: number;
}

export interface TripOption {
  readonly id: string;
  readonly name: string;
}

/** The most severe event tone of a trip. */
export function worstTone(events: readonly TripEvent[]): StatusTone {
  if (events.some((event) => event.tone === 'danger')) return 'danger';
  return events.some((event) => event.tone === 'warn') ? 'warn' : 'info';
}

/**
 * The Trips list page: a read-only list (no selection or bulk actions). A row opens the trip in
 * a view drawer with its timeline, or its vehicle's profile from the row menu. Presentation only:
 * the host owns data and list state.
 */
@Component({
  selector: 'holita-trips-view',
  imports: [
    TableModule,
    Tag,
    FilterBuilder,
    FormatDateTimePipe,
    FormatDurationPipe,
    FormatNumberPipe,
    KpiStrip,
    KpiTile,
    PageHeader,
    ListSortMenu,
    RowActions,
    TablePanel,
  ],
  templateUrl: './trips-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class TripsView {
  readonly branchName = input.required<string>();
  readonly rows = input.required<readonly TripRow[]>();
  readonly total = input.required<number>();
  readonly view = input.required<TableView>();
  readonly state = input.required<ListQuery>();
  readonly kpis = input<TripKpis | null>(null);
  readonly vehicles = input<readonly TripOption[]>([]);
  readonly drivers = input<readonly TripOption[]>([]);
  readonly stateChange = output<ListQuery>();
  /** Row actions, with the ID of the trip. */
  readonly action = output<ListActionRequest<TripActionId>>();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly sortReady = injectSortReady();
  protected readonly text = computed(() => tripsText(this.language()));
  protected readonly description = computed(() =>
    interpolate(this.text().description, { branch: this.branchName() }),
  );
  protected readonly sortFields = computed<readonly ListSortField[]>(() => [
    { field: 'startedAt', label: this.text().table.started },
    { field: 'distance', label: this.text().table.distance },
    { field: 'duration', label: this.text().table.duration },
    { field: 'score', label: this.text().table.score },
  ]);
  protected readonly fields = computed<readonly FilterField[]>(() => {
    const text = this.text();
    const options = (items: readonly TripOption[]) =>
      items.map((item) => ({ value: item.id, label: item.name }));
    return [
      {
        key: 'vehicle',
        label: text.filters.vehicle,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf'],
        options: options(this.vehicles()),
      },
      {
        key: 'driver',
        label: text.filters.driver,
        type: 'enum',
        operators: ['isAnyOf', 'isNoneOf', 'isEmpty'],
        options: options(this.drivers()),
      },
      {
        key: 'startedAt',
        label: text.filters.startedAt,
        type: 'date',
        operators: ['on', 'after', 'before', 'between'],
      },
      {
        key: 'distance',
        label: text.filters.distance,
        type: 'number',
        unit: 'km',
        operators: ['gt', 'lt', 'between'],
      },
      { key: 'score', label: text.filters.score, type: 'number', operators: ['lt', 'gt'] },
      {
        key: 'hasEvents',
        label: text.filters.hasEvents,
        type: 'boolean',
        operators: ['isTrue', 'isFalse'],
      },
    ];
  });
  /** The list's actions for the row menu; a read-only list has no bulk actions. */
  protected readonly actions = computed<readonly ListAction<TripActionId, TripRow>[]>(() => {
    const text = this.text().actions;
    return [
      { id: 'open', label: text.open },
      { id: 'vehicle', label: text.vehicle },
    ];
  });
  private readonly records = computed(
    () => new Map(this.rows().map((row) => [row.id, this.toRecord(row)])),
  );
  protected readonly trackById = trackById;
  /** PrimeNG's table takes a mutable array. */
  protected readonly tableRows = computed(() => [...this.rows()]);
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

  protected openLabel(row: TripRow): string {
    return interpolate(this.text().table.open, { trip: this.recordOf(row).label });
  }

  protected eventsSeverity(row: TripRow) {
    return toneSeverity(worstTone(row.events));
  }

  protected eventsLabel(row: TripRow): string {
    return interpolate(this.text().table.eventCount, { count: row.events.length });
  }

  protected scoreClass(score: number): string {
    return `app-meter app-meter--${scoreTone(score)}`;
  }

  protected recordOf(row: TripRow): ListRecord<TripActionId> {
    return this.records().get(row.id) ?? this.toRecord(row);
  }

  protected changeSearch(search: string): void {
    this.stateChange.emit(listQuery.search(this.state(), search));
  }

  protected changeSort(sort: NonNullable<ListQuery['sort']>): void {
    this.stateChange.emit({ ...this.state(), sort, page: 1 });
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

  /** A trip is recognised by its vehicle and start, e.g. "CB 1001 AX, 18 Oct 2026, 08:12". */
  private toRecord(row: TripRow): ListRecord<TripActionId> {
    const label = interpolate(this.text().table.tripName, {
      plate: row.plate,
      started: formatDateTime(row.startedAt, this.language(), displayTimeZone),
    });
    return listRecord(this.actions(), row, row.id, label);
  }
}
