import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InputText } from 'primeng/inputtext';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { ChartPanel, type ChartPanelPoint } from '../../../ui/chart-panel/chart-panel';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import { injectFleetNow } from '../../../ui/fleet-live/fleet-clock';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { formatNumber, formatRelative } from '../../../ui/format/format';
import { VehicleProfileApi } from './vehicle-profile-api';
import bg from './vehicle-parameters.bg.json';
import en from './vehicle-parameters.en.json';

interface LatestValue {
  readonly parameterId: number;
  readonly name?: string | null;
  readonly unit?: string | null;
  readonly recordedAt: string;
  readonly valueHex: string;
  readonly value?: number | null;
}

type Topic = keyof typeof en.groups;

/** First match wins; the Monitor catalog categories are vehicle classes, not topics. */
const topics: readonly (readonly [Topic, RegExp])[] = [
  ['telltales', /^telltale/i],
  ['tachograph', /tacho|driver \d|driver card/i],
  ['fuel', /fuel|exhaust fluid/i],
  ['brakes', /brake|abs|ebs|retarder/i],
  ['engine', /engine|accelerator|barometric|torque/i],
  ['driving', /speed|gear|transmission|cruise|distance|axle|takeoff|motion/i],
  ['electrical', /battery|voltage/i],
];
const units: Readonly<Record<string, string>> = { c: '°C', meters: 'm' };
const HISTORY_MS = 86_400_000;

function topicOf(name: string): Topic {
  return topics.find(([, pattern]) => pattern.test(name))?.[0] ?? 'other';
}

/** Every eData parameter the vehicle reported, grouped by topic, with a 24-hour chart on demand. */
@Component({
  selector: 'discocan-vehicle-parameters',
  imports: [ChartPanel, EmptyState, InputText],
  providers: [VehicleProfileApi],
  templateUrl: './vehicle-parameters.html',
  styleUrl: './vehicle-parameters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class VehicleParameters implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  readonly vehicleId = input.required<string>();

  private readonly api = inject(VehicleProfileApi);
  protected readonly format = injectFleetFormat();
  private readonly now = injectFleetNow();
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  private readonly values = signal<readonly LatestValue[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly selectedId = signal<number | null>(null);
  protected readonly history = signal<{
    readonly points: readonly ChartPanelPoint[];
    readonly values: readonly (number | null)[];
    readonly truncated: boolean;
  } | null>(null);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  private historyRequest = 0;

  protected readonly rows = computed(() =>
    this.values().map((item) => {
      const name = item.name ?? `ID ${String(item.parameterId)}`;
      const unit = item.unit ? (units[item.unit] ?? item.unit) : '';
      return {
        id: item.parameterId,
        name,
        topic: topicOf(name),
        unit,
        value:
          item.value == null
            ? `0x${item.valueHex}`
            : formatNumber(item.value, this.language(), { fraction: 4 }),
        raw: `ID ${String(item.parameterId)} · 0x${item.valueHex}`,
        recordedAt: item.recordedAt,
      };
    }),
  );
  protected readonly groups = computed(() => {
    const query = this.search().trim().toLowerCase();
    const rows = this.rows().filter(
      (row) => !query || `${row.name} ${String(row.id)}`.toLowerCase().includes(query),
    );
    return [...topics.map(([topic]) => topic), 'other' as const].flatMap((topic) => {
      const items = rows
        .filter((row) => row.topic === topic)
        .sort((a, b) => a.name.localeCompare(b.name));
      return items.length ? [{ topic, items }] : [];
    });
  });
  protected readonly selected = computed(
    () => this.rows().find((row) => row.id === this.selectedId()) ?? null,
  );

  constructor() {
    effect((onCleanup) => {
      const vehicleId = this.vehicleId();
      this.values.set([]);
      this.loading.set(true);
      this.error.set(null);
      const subscription = this.api.watchEdataLatest(vehicleId).valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ? requestError(result.error, this.text().error) : null);
          if (result.dataState === 'complete' && !result.error) {
            this.values.set(result.data.fleetVehicleEdataLatest);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(requestError(error, this.text().error));
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
  }

  protected filter(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.search.set(event.target.value);
    }
  }

  protected relative(iso: string): string {
    return formatRelative(iso, this.now(), this.language());
  }

  protected async toggle(parameterId: number): Promise<void> {
    if (this.selectedId() === parameterId) {
      this.selectedId.set(null);
      return;
    }
    const request = ++this.historyRequest;
    this.selectedId.set(parameterId);
    this.history.set(null);
    this.historyError.set(null);
    this.historyLoading.set(true);
    const to = new Date(this.now() + 60_000);
    try {
      const result = await firstValueFrom(
        this.api.edataHistory(
          this.vehicleId(),
          parameterId,
          new Date(to.getTime() - HISTORY_MS).toISOString(),
          to.toISOString(),
        ),
      );
      const series = result.data?.fleetVehicleEdataMeasurements;
      if (request === this.historyRequest && series) {
        this.history.set({
          points: series.items.map((item) => ({
            id: item.id,
            label: this.format.time(item.recordedAt),
          })),
          values: series.items.map((item) =>
            item.value == null ? Number.parseInt(item.valueHex, 16) : item.value,
          ),
          truncated: series.truncated,
        });
      }
    } catch (error: unknown) {
      if (request === this.historyRequest) {
        this.historyError.set(requestError(error, this.text().error));
      }
    } finally {
      if (request === this.historyRequest) {
        this.historyLoading.set(false);
      }
    }
  }
}
