import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import type {
  FleetEvidenceFragment,
  FleetEvidencePeriodFragment,
  FleetScenarioCoverageFragment,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { formatDateTime, formatNumber } from '../format/format';
import { listRecord, type ListAction, type ListActionRequest } from '../list/list-actions';
import type { MapCoordinates } from '../map-preview/location-map';
import { MapPreview } from '../map-preview/map-preview';
import { RowActions } from '../row-actions/row-actions';
import { SourceContext } from '../source-context/source-context';
import { TablePanel, type TablePage } from '../table-panel/table-panel';
import { tableView } from '../table-panel/table-view';
import bg from './bg.json';
import en from './en.json';

export interface PointExplorerFact {
  readonly label: string;
  readonly value: string;
}

export interface PointExplorerRow {
  readonly key: string;
  readonly source: string;
  readonly id: string;
  readonly sourceTime: string | null;
  readonly instantUtc: string | null;
  readonly coordinates: MapCoordinates | null;
  readonly provenance: FleetEvidenceFragment | null;
  readonly facts: readonly PointExplorerFact[];
}

export interface PointExplorerEndpoints {
  readonly origin: MapCoordinates | null;
  readonly destination: MapCoordinates | null;
  readonly originTime: string | null;
  readonly destinationTime: string | null;
}

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-point-explorer',
  imports: [ButtonDirective, MapPreview, RowActions, SourceContext, TableModule, TablePanel],
  templateUrl: './point-explorer.html',
  styleUrl: './point-explorer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view', '[attr.lang]': 'language()' },
})
export class PointExplorer {
  readonly language = input.required<Language>();
  readonly identity = input.required<string>();
  readonly endpoints = input.required<PointExplorerEndpoints>();
  readonly points = input<readonly PointExplorerRow[] | null>(null);
  readonly selectedKey = input<string | null>(null);
  readonly provenance = input<FleetEvidenceFragment | null>(null);
  readonly period = input<FleetEvidencePeriodFragment | null>(null);
  readonly coverage = input<FleetScenarioCoverageFragment | null>(null);
  readonly gapThresholdMinutes = input(15);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly showMap = input(true);
  readonly selectedKeyChange = output<string | null>();
  readonly retry = output();

  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly endpointMode = computed(() => this.selectedKey() === null);
  protected readonly selected = computed(
    () => this.points()?.find((point) => point.key === this.selectedKey()) ?? null,
  );
  protected readonly activeProvenance = computed(
    () => this.selected()?.provenance ?? this.provenance(),
  );
  private readonly timedPoints = computed(() => {
    const timed = (this.points() ?? []).map((point) => {
      const parsed = point.instantUtc === null ? null : Date.parse(point.instantUtc);
      return {
        point,
        instant: parsed !== null && Number.isFinite(parsed) ? parsed : null,
      };
    });
    const chronological = timed.length > 0 && timed.every((row) => row.instant !== null);
    if (chronological) {
      timed.sort((left, right) => (left.instant ?? 0) - (right.instant ?? 0));
    }
    return { rows: timed, chronological };
  });
  protected readonly chronological = computed(() => this.timedPoints().chronological);
  protected readonly orderedPoints = computed(() =>
    this.timedPoints().rows.map((row) => row.point),
  );
  protected readonly validPoints = computed(() =>
    this.timedPoints().rows.filter((row) => row.point.coordinates !== null),
  );
  protected readonly distinctCoordinates = computed(
    () =>
      new Set(
        this.validPoints().flatMap(({ point }) =>
          point.coordinates
            ? [`${String(point.coordinates.latitude)}/${String(point.coordinates.longitude)}`]
            : [],
        ),
      ).size,
  );
  protected readonly intervalsAssessed = computed(
    () => this.chronological() && this.validPoints().length >= 2,
  );
  protected readonly longIntervals = computed(() => {
    if (!this.intervalsAssessed()) {
      return [];
    }
    return this.validPoints().flatMap((current, index, rows) => {
      const previous = rows[index - 1];
      if (!previous || previous.instant === null || current.instant === null) {
        return [];
      }
      const minutes = (current.instant - previous.instant) / 60000;
      return minutes > this.gapThresholdMinutes()
        ? [{ from: previous.point, to: current.point, minutes }]
        : [];
    });
  });
  protected readonly mapOrigin = computed(() =>
    this.endpointMode() ? this.endpoints().origin : (this.selected()?.coordinates ?? null),
  );
  protected readonly mapDestination = computed(() =>
    this.endpointMode() ? this.endpoints().destination : null,
  );
  protected readonly mapOriginTime = computed(() =>
    this.endpointMode() ? this.endpoints().originTime : (this.selected()?.sourceTime ?? null),
  );
  protected readonly mapDestinationTime = computed(() =>
    this.endpointMode() ? this.endpoints().destinationTime : null,
  );
  protected readonly mapIdentity = computed(() => {
    if (this.endpointMode()) {
      return this.identity();
    }
    const point = this.selected();
    return point
      ? `${this.identity()} · ${this.sourceLabel(point.source)} · ${point.id}`
      : `${this.identity()} · ${this.selectedKey() ?? '—'}`;
  });
  protected readonly actions = computed<readonly ListAction<'select', PointExplorerRow>[]>(() => [
    { id: 'select', label: this.text().inspect },
  ]);
  protected readonly pagination = linkedSignal<
    { readonly points: readonly PointExplorerRow[]; readonly selectedKey: string | null },
    { readonly page: number; readonly pageSize: number }
  >({
    source: () => ({ points: this.orderedPoints(), selectedKey: this.selectedKey() }),
    computation: ({ points, selectedKey }, previous) => {
      const pageSize = previous?.value.pageSize ?? 10;
      const index = points.findIndex((point) => point.key === selectedKey);
      return { page: index < 0 ? 1 : Math.floor(index / pageSize) + 1, pageSize };
    },
  });
  protected readonly page = computed<TablePage>(() => ({
    ...this.pagination(),
    total: this.points()?.length ?? 0,
  }));
  protected readonly rows = computed(() => {
    const { page, pageSize } = this.pagination();
    const first = (page - 1) * pageSize;
    return this.orderedPoints().slice(first, first + pageSize);
  });
  protected readonly selectedOutsidePage = computed(
    () =>
      this.selected() !== null && !this.rows().some((point) => point.key === this.selectedKey()),
  );
  protected readonly tableState = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.points()?.length ?? (this.loading() ? null : 0),
      filtered: false,
    }),
  );

  protected sourceLabel(source: string): string {
    if (source === 'HOLITA_SCENARIO') {
      return this.text().example;
    }
    return source === 'KARMA_API' ? this.text().karma : source;
  }

  protected record(row: PointExplorerRow) {
    return listRecord(this.actions(), row, row.key, `${this.sourceLabel(row.source)} ${row.id}`);
  }

  protected trackPoint(_index: number, row: PointExplorerRow): string {
    return row.key;
  }

  protected select(request: ListActionRequest<'select'>): void {
    const key = request.ids[0];
    if (key) {
      this.selectedKeyChange.emit(key);
    }
  }

  protected changePage(page: { readonly page: number; readonly pageSize: number }): void {
    this.pagination.set(page);
  }

  protected revealSelected(): void {
    const index = this.orderedPoints().findIndex((point) => point.key === this.selectedKey());
    const { pageSize } = this.pagination();
    if (index >= 0) {
      this.pagination.set({ page: Math.floor(index / pageSize) + 1, pageSize });
    }
  }

  protected number(value: number): string {
    return formatNumber(value, this.language(), { fraction: 1 });
  }

  protected declaredTime(value: string): string {
    return formatDateTime(value, this.language(), this.period()?.timeZone ?? 'UTC', true);
  }
}
