import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import type {
  FleetEvidenceFragment,
  FleetEvidencePeriodFragment,
  FleetScenarioCoverageFragment,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { Sparkline, type SparkPoint } from '../charts/sparkline';
import { FormField } from '../form-field/form-field';
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

export interface MeasurementChannel {
  readonly key: string;
  readonly id: string;
  readonly label: string;
  readonly unit: string | null;
  readonly unitConfirmed: boolean;
  readonly limitation: string | null;
}

export interface MeasurementReading {
  readonly channelKey: string;
  readonly id: string | null;
  readonly value: number | null;
  readonly description: string | null;
  readonly provenance: FleetEvidenceFragment | null;
}

export interface MeasurementRecord {
  readonly key: string;
  readonly source: string;
  readonly id: string;
  readonly sourceTime: string | null;
  readonly instantUtc: string | null;
  readonly coordinates: MapCoordinates | null;
  readonly provenance: FleetEvidenceFragment | null;
  readonly readings: readonly MeasurementReading[];
}

interface TimedRecord {
  readonly record: MeasurementRecord;
  readonly at: number | null;
}

const catalogs: Record<Language, typeof en> = { bg, en };
let nextId = 0;

@Component({
  selector: 'holita-measurement-workspace',
  imports: [
    ButtonDirective,
    FormField,
    FormsModule,
    MapPreview,
    Message,
    RowActions,
    SelectModule,
    SourceContext,
    Sparkline,
    TableModule,
    TablePanel,
  ],
  templateUrl: './measurement-workspace.html',
  styleUrl: './measurement-workspace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view', '[attr.lang]': 'language()' },
})
export class MeasurementWorkspace {
  readonly language = input.required<Language>();
  readonly identity = input.required<string>();
  readonly scopeHint = input.required<string>();
  readonly channels = input<readonly MeasurementChannel[]>([]);
  readonly records = input<readonly MeasurementRecord[] | null>(null);
  readonly selectedChannelKey = input<string | null>(null);
  readonly selectedRecordKey = input<string | null>(null);
  readonly provenance = input<FleetEvidenceFragment | null>(null);
  readonly period = input<FleetEvidencePeriodFragment | null>(null);
  readonly coverage = input<FleetScenarioCoverageFragment | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly gapThresholdMinutes = input(15);
  readonly showMap = input(true);
  readonly selectedChannelKeyChange = output<string | null>();
  readonly selectedRecordKeyChange = output<string | null>();
  readonly retry = output();

  protected readonly id = `measurement-workspace-${String(nextId++)}`;
  protected readonly text = computed(() => catalogs[this.language()]);
  private readonly timedRecords = computed<readonly TimedRecord[]>(() => {
    const timed = (this.records() ?? []).map((record) => {
      const parsed = record.instantUtc === null ? null : Date.parse(record.instantUtc);
      return { record, at: parsed !== null && Number.isFinite(parsed) ? parsed : null };
    });
    if (timed.length && timed.every((row) => row.at !== null)) {
      timed.sort((left, right) => (left.at ?? 0) - (right.at ?? 0));
    }
    return timed;
  });
  protected readonly chronological = computed(
    () => this.timedRecords().length > 0 && this.timedRecords().every((row) => row.at !== null),
  );
  protected readonly orderedRecords = computed(() => this.timedRecords().map((row) => row.record));
  protected readonly capabilities = computed(() =>
    this.channels().map((channel) => {
      const observed = this.timedRecords().filter(({ record }) =>
        record.readings.some((reading) => reading.channelKey === channel.key),
      );
      const numeric = observed.filter(({ record }) =>
        record.readings.some(
          (reading) => reading.channelKey === channel.key && reading.value !== null,
        ),
      );
      return {
        channel,
        numeric: numeric.length,
        nulls: observed.length - numeric.length,
        absent: this.timedRecords().length - observed.length,
        lastObserved: this.latestTime(observed),
        lastNumeric: this.latestTime(numeric),
      };
    }),
  );
  protected readonly selectedCapability = computed(() => {
    const key = this.selectedChannelKey();
    return key === null
      ? (this.capabilities().find((capability) => capability.numeric > 0) ??
          this.capabilities()[0] ??
          null)
      : (this.capabilities().find((capability) => capability.channel.key === key) ?? null);
  });
  protected readonly selectedChannel = computed(() => this.selectedCapability()?.channel ?? null);
  protected readonly channelOptions = computed(() =>
    this.channels().map((channel) => ({
      key: channel.key,
      label: `${channel.label} · ${channel.id}`,
    })),
  );
  protected readonly selectedRecord = computed(
    () => this.records()?.find((record) => record.key === this.selectedRecordKey()) ?? null,
  );
  protected readonly selectedReading = computed(() => {
    const record = this.selectedRecord();
    return record ? this.reading(record) : null;
  });
  protected readonly activeProvenance = computed(
    () =>
      this.selectedReading()?.provenance ?? this.selectedRecord()?.provenance ?? this.provenance(),
  );
  protected readonly chart = computed(() => {
    if (!this.chronological() || !this.selectedChannel()) {
      return null;
    }
    const points: SparkPoint[] = [];
    const values: number[] = [];
    const rows = this.timedRecords();
    for (const [index, row] of rows.entries()) {
      const at = row.at;
      if (at === null) {
        return null;
      }
      const previousAt = rows[index - 1]?.at;
      if (previousAt !== null && previousAt !== undefined) {
        const longInterval = (at - previousAt) / 60000 > this.gapThresholdMinutes();
        const declaredGap = (this.coverage()?.gaps ?? []).some(
          (gap) => Date.parse(gap.from) < at && Date.parse(gap.toExclusive) > previousAt,
        );
        if (longInterval || declaredGap) {
          points.push({ at, value: null });
        }
      }
      const value = this.reading(row.record)?.value ?? null;
      points.push({ at, value });
      if (value !== null) {
        values.push(value);
      }
    }
    const first = rows[0]?.at;
    const last = rows.at(-1)?.at;
    if (
      !values.length ||
      first === null ||
      first === undefined ||
      last === null ||
      last === undefined
    ) {
      return null;
    }
    const low = Math.min(...values);
    const high = Math.max(...values);
    return { points, from: first, to: last, low, high: high > low ? high : low + 1 };
  });
  protected readonly chartLabel = computed(() => {
    const channel = this.selectedChannel();
    return channel
      ? `${channel.unitConfirmed ? channel.label : `${this.text().sourceLabel}: ${channel.label}`} · ${channel.id} · ${this.unit(channel)}`
      : this.text().chart;
  });
  protected readonly actions = computed<readonly ListAction<'select', MeasurementRecord>[]>(() => [
    { id: 'select', label: this.text().inspect },
  ]);
  protected readonly pagination = linkedSignal<
    {
      readonly records: readonly MeasurementRecord[];
      readonly channel: MeasurementChannel | null;
      readonly selectedKey: string | null;
    },
    { readonly page: number; readonly pageSize: number }
  >({
    source: () => ({
      records: this.orderedRecords(),
      channel: this.selectedChannel(),
      selectedKey: this.selectedRecordKey(),
    }),
    computation: ({ records, selectedKey }, previous) => {
      const pageSize = previous?.value.pageSize ?? 10;
      const index = records.findIndex((record) => record.key === selectedKey);
      return { page: index < 0 ? 1 : Math.floor(index / pageSize) + 1, pageSize };
    },
  });
  protected readonly page = computed<TablePage>(() => ({
    ...this.pagination(),
    total: this.records()?.length ?? 0,
  }));
  protected readonly rows = computed(() => {
    const { page, pageSize } = this.pagination();
    const first = (page - 1) * pageSize;
    return this.orderedRecords().slice(first, first + pageSize);
  });
  protected readonly selectedOutsidePage = computed(
    () =>
      this.selectedRecord() !== null &&
      !this.rows().some((record) => record.key === this.selectedRecordKey()),
  );
  protected readonly tableState = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.records()?.length ?? (this.loading() ? null : 0),
      filtered: false,
    }),
  );
  protected readonly mapIdentity = computed(() => {
    const record = this.selectedRecord();
    return record
      ? `${this.identity()} · ${this.sourceLabel(record.source)} · ${record.id}`
      : this.identity();
  });

  protected reading(record: MeasurementRecord): MeasurementReading | null {
    return (
      record.readings.find((reading) => reading.channelKey === this.selectedChannel()?.key) ?? null
    );
  }

  protected value(record: MeasurementRecord): string {
    const reading = this.reading(record);
    return reading === null
      ? this.text().absentValue
      : reading.value === null
        ? this.text().nullValue
        : this.number(reading.value);
  }

  protected unit(channel: MeasurementChannel): string {
    return channel.unitConfirmed
      ? (channel.unit ?? this.text().noUnit)
      : `${channel.unit ? channel.unit + ' · ' : ''}${this.text().rawUnit}`;
  }

  protected sourceLabel(source: string): string {
    if (source === 'HOLITA_SCENARIO') {
      return this.text().example;
    }
    return source === 'KARMA_API' ? this.text().karma : source;
  }

  protected chooseChannel(value: unknown): void {
    if (typeof value === 'string') {
      this.selectedChannelKeyChange.emit(value);
    }
  }

  protected record(row: MeasurementRecord) {
    return listRecord(this.actions(), row, row.key, `${this.sourceLabel(row.source)} ${row.id}`);
  }

  protected trackRecord(_index: number, row: MeasurementRecord): string {
    return row.key;
  }

  protected select(request: ListActionRequest<'select'>): void {
    const key = request.ids[0];
    if (key) {
      this.selectedRecordKeyChange.emit(key);
    }
  }

  protected changePage(page: { readonly page: number; readonly pageSize: number }): void {
    this.pagination.set(page);
  }

  protected revealSelected(): void {
    const index = this.orderedRecords().findIndex(
      (record) => record.key === this.selectedRecordKey(),
    );
    const { pageSize } = this.pagination();
    if (index >= 0) {
      this.pagination.set({ page: Math.floor(index / pageSize) + 1, pageSize });
    }
  }

  protected number(value: number | null): string {
    return formatNumber(value, this.language(), { significantDigits: 15 });
  }

  protected axisTime(value: number): string {
    return formatDateTime(
      new Date(value).toISOString(),
      this.language(),
      this.period()?.timeZone ?? 'UTC',
      true,
    );
  }

  private latestTime(rows: readonly TimedRecord[]): string | null {
    if (!rows.length || rows.some((row) => row.at === null)) {
      return null;
    }
    const latest = rows.reduce((left, right) => ((left.at ?? 0) >= (right.at ?? 0) ? left : right));
    return latest.record.sourceTime;
  }
}
