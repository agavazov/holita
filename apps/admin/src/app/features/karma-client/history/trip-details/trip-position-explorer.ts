import { MAP_PAGE_TYPE } from '../../../../ui/map-preview/map-preview';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import type {
  AdminKarmaPositionSamplesQuery,
  FleetEvidenceFragment,
  FleetScenarioCoverageFragment,
  KarmaPositionSamplesInput,
  KarmaTripFieldsFragment,
} from '../../../../../generated/graphql/operations';
import { ButtonDirective } from 'primeng/button';
import { messages, type Language } from '../../../../i18n/messages';
import { downloadJson } from '../../../../ui/download-json';
import { formatNumber } from '../../../../ui/format/format';
import { mapCoordinates } from '../../../../ui/map-preview/location-map';
import {
  PointExplorer,
  type PointExplorerEndpoints,
  type PointExplorerRow,
} from '../../../../ui/point-explorer/point-explorer';
import { KarmaHistoryApi } from '../karma-history-api';
import { tripPointBrief, tripPointEvidence } from '../../daily-report/report-evidence';
import bg from './trip-position-explorer.bg.json';
import en from './trip-position-explorer.en.json';

type Result = AdminKarmaPositionSamplesQuery['karmaPositionSamples'];
const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-trip-position-explorer',
  imports: [PointExplorer, ButtonDirective],
  providers: [{ provide: MAP_PAGE_TYPE, useValue: 'trip-details' }, KarmaHistoryApi],
  templateUrl: './trip-position-explorer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class TripPositionExplorer implements OnInit {
  readonly language = input.required<Language>();
  readonly trip = input.required<KarmaTripFieldsFragment>();
  readonly provenance = input<FleetEvidenceFragment | null>(null);
  private readonly api = inject(KarmaHistoryApi);
  private readonly injector = inject(Injector);
  private read: ReturnType<KarmaHistoryApi['watchPositionSamples']> | undefined;
  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly appText = computed(() => messages[this.language()]);
  protected readonly result = signal<Result | null>(null);
  protected readonly loading = signal(false);
  private readonly failed = signal(false);
  protected readonly selectedKey = signal<string | null>(null);
  protected readonly includeCoordinates = signal(false);
  protected readonly brief = computed(() =>
    tripPointBrief(this.trip(), this.result(), this.selectedKey(), this.language()),
  );
  protected readonly identity = computed(() => {
    const trip = this.trip();
    return `${trip.carNumber} · ${this.appText().karmaTripId} ${trip.id}`;
  });
  private readonly selection = computed<KarmaPositionSamplesInput | null>(() => {
    const trip = this.trip();
    const validId = (value: string | null | undefined): value is string =>
      !!value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
    return validId(trip.startMessageId) &&
      validId(trip.stopMessageId) &&
      Number(trip.startMessageId) <= Number(trip.stopMessageId) &&
      trip.tripActive === 0 &&
      !!trip.stopDate
      ? {
          carId: trip.carId,
          startMessageId: trip.startMessageId,
          stopMessageId: trip.stopMessageId,
        }
      : null;
  });
  protected readonly endpoints = computed<PointExplorerEndpoints>(() => ({
    origin: mapCoordinates(this.trip().startLatitude, this.trip().startLongitude),
    destination: mapCoordinates(this.trip().stopLatitude, this.trip().stopLongitude),
    originTime: this.trip().startDate ?? null,
    destinationTime: this.trip().stopDate ?? null,
  }));
  protected readonly source = computed<FleetEvidenceFragment | null>(() => {
    const result = this.result();
    return result
      ? {
          origin: result.retrieval === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'OBSERVED',
          source: 'KARMA_API',
          sourceRecordId: this.trip().id,
          scenarioId: null,
          eventAt: null,
          receivedAt: null,
          retrievedAt: result.retrievedAt,
        }
      : this.provenance();
  });
  protected readonly coverage = computed<FleetScenarioCoverageFragment>(() => ({
    retrieval: this.result()?.retrieval ?? (this.failed() ? 'UNAVAILABLE' : 'NOT_STARTED'),
    positionCoverage: 'NOT_ASSESSED',
    positionsLoaded: this.result()?.samples.length ?? 0,
    gaps: [],
  }));
  private readonly endpointRows = computed<readonly PointExplorerRow[]>(() => {
    const trip = this.trip();
    const endpoints = this.endpoints();
    return [
      {
        key: `start:${trip.id}`,
        source: this.text().start,
        id: trip.startMessageId ?? '—',
        sourceTime: trip.startDate ?? null,
        instantUtc: null,
        coordinates: endpoints.origin,
        provenance: this.provenance(),
        facts: [],
      },
      {
        key: `stop:${trip.id}`,
        source: this.text().stop,
        id: trip.stopMessageId ?? '—',
        sourceTime: trip.stopDate ?? null,
        instantUtc: null,
        coordinates: endpoints.destination,
        provenance: this.provenance(),
        facts: [],
      },
    ];
  });
  protected readonly points = computed<readonly PointExplorerRow[]>(() => {
    const result = this.result();
    if (!result?.samples.length) {
      return this.endpointRows();
    }
    return result.samples.map<PointExplorerRow>(({ event, instantUtc }) => ({
      key: `KARMA_API:${event.id}`,
      source: this.text().event,
      id: event.id,
      sourceTime: event.edt ?? null,
      instantUtc: instantUtc ?? null,
      coordinates: mapCoordinates(event.latitude, event.longitude),
      provenance: {
        origin: 'OBSERVED',
        source: 'KARMA_API',
        scenarioId: null,
        sourceRecordId: event.id,
        eventAt: instantUtc ?? null,
        receivedAt: null,
        retrievedAt: result.retrievedAt,
      },
      facts: [
        { label: this.text().eventCode, value: event.eventId },
        { label: this.text().speed, value: this.raw(event.spd) },
        { label: this.text().odometer, value: this.raw(event.odo) },
      ],
    }));
  });
  protected readonly endpointFallback = computed(() => !this.result()?.samples.length);
  protected readonly failure = computed(() =>
    this.failed()
      ? this.result()?.samples.length
        ? this.text().refreshFailed
        : this.text().unavailable
      : null,
  );
  protected readonly reason = computed(() => {
    const result = this.result();
    return result ? this.text().reasons[result.reason] : null;
  });

  ngOnInit(): void {
    this.api.initialize(this.language());
    effect(
      (onCleanup) => {
        this.trip();
        const selection = this.selection();
        this.result.set(null);
        this.failed.set(false);
        this.selectedKey.set(null);
        this.includeCoordinates.set(false);
        this.loading.set(false);
        this.read = undefined;
        if (!selection) {
          return;
        }
        const read = this.api.watchPositionSamples(selection);
        this.read = read;
        this.loading.set(true);
        const subscription = read.valueChanges.subscribe({
          next: (result) => {
            this.loading.set(result.loading);
            this.failed.set(!!result.error);
            if (result.dataState === 'complete' && !result.error) {
              this.result.set(result.data.karmaPositionSamples);
            }
          },
          error: () => {
            this.loading.set(false);
            this.failed.set(true);
          },
        });
        onCleanup(() => {
          subscription.unsubscribe();
        });
      },
      { injector: this.injector },
    );
  }

  protected refresh(): void {
    if (this.loading() || !this.read) {
      return;
    }
    this.failed.set(false);
    void this.read.refetch().catch(() => {
      this.failed.set(true);
    });
  }

  protected exportEvidence(): void {
    downloadJson(
      `holita-karma-trip-${this.trip().id}.json`,
      tripPointEvidence(
        this.trip(),
        this.result(),
        this.selectedKey(),
        this.language(),
        this.includeCoordinates(),
        this.failed(),
      ),
    );
  }

  private raw(value: number | null | undefined): string {
    return formatNumber(value, this.language(), { significantDigits: 15 });
  }
}
