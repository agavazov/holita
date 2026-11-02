import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Skeleton } from 'primeng/skeleton';
import type {
  FleetEvidenceFragment,
  FleetEvidencePeriodFragment,
  FleetScenarioCoverageFragment,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { StackedBars, type StackedLegendItem, type StackedRow } from '../charts/stacked-bars';
import { KpiStrip } from '../kpi/kpi-strip';
import { KpiTile } from '../kpi/kpi-tile';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
} from '../list/list-actions';
import { RowActions } from '../row-actions/row-actions';
import { SourceContext } from '../source-context/source-context';
import { TablePanel, type TablePage } from '../table-panel/table-panel';
import { tableView } from '../table-panel/table-view';
import bg from './bg.json';
import en from './en.json';

export interface DayMetricView {
  readonly value: string | null;
  readonly unit: string | null;
  readonly context: string;
  readonly explanation: string;
}

export interface DayTripRow {
  readonly id: string;
  readonly start: string;
  readonly stop: string;
  readonly distance: string;
}

const catalogs: Record<Language, typeof en> = { bg, en };

/** A bounded day's presentation; the owner supplies values, source facts and the active map. */
@Component({
  selector: 'holita-day-overview',
  imports: [
    KpiStrip,
    KpiTile,
    RowActions,
    Skeleton,
    SourceContext,
    StackedBars,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './day-overview.html',
  styleUrl: './day-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view', '[attr.lang]': 'language()' },
})
export class DayOverview {
  readonly language = input.required<Language>();
  readonly provenance = input<FleetEvidenceFragment | null>(null);
  readonly period = input<FleetEvidencePeriodFragment | null>(null);
  readonly coverage = input<FleetScenarioCoverageFragment | null>(null);
  readonly distance = input<DayMetricView | null>(null);
  readonly tripCount = input<DayMetricView | null>(null);
  readonly maximumSpeed = input<DayMetricView | null>(null);
  readonly composition = input<readonly StackedRow[]>([]);
  readonly compositionHint = input<string | null>(null);
  readonly trips = input<readonly DayTripRow[] | null>(null);
  readonly loading = input(false);
  readonly error = input(false);
  readonly status = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly viewTrip = output<string>();
  readonly retry = output();

  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly rowTrackBy = trackById;
  protected readonly legend = computed<readonly StackedLegendItem[]>(() => [
    { key: 'day', label: this.text().day, tone: 'c1' },
    { key: 'night', label: this.text().night, tone: 'c2' },
  ]);
  protected readonly actions = computed<readonly ListAction<'view', DayTripRow>[]>(() => [
    { id: 'view', label: this.text().viewTrip },
  ]);
  protected readonly pagination = linkedSignal(() => {
    this.trips();
    return { page: 1, pageSize: 10 };
  });
  protected readonly page = computed<TablePage>(() => ({
    ...this.pagination(),
    total: this.trips()?.length ?? 0,
  }));
  protected readonly rows = computed(() => {
    const { page, pageSize } = this.pagination();
    const first = (page - 1) * pageSize;
    return this.trips()?.slice(first, first + pageSize) ?? [];
  });
  protected readonly tableState = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error() ? true : null,
      rows: this.trips()?.length ?? (this.loading() ? null : 0),
      filtered: false,
    }),
  );

  protected record(row: DayTripRow) {
    return listRecord(
      this.actions(),
      row,
      row.id,
      `${this.text().tripId} ${row.id} · ${row.start}`,
    );
  }

  protected runAction(request: ListActionRequest<'view'>): void {
    const id = request.ids[0];
    if (id) {
      this.viewTrip.emit(id);
    }
  }

  protected changePage(page: { readonly page: number; readonly pageSize: number }): void {
    this.pagination.set(page);
  }
}
