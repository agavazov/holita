import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type {
  AdminFleetScenarioQuery,
  FleetEvidenceFragment,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import type { StackedRow } from '../../../ui/charts/stacked-bars';
import {
  DayOverview,
  type DayMetricView,
  type DayTripRow,
} from '../../../ui/day-overview/day-overview';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { formatDateTime, formatNumber } from '../../../ui/format/format';
import { isoToZonedWallTime } from '../../../ui/format/zoned-time';
import { PageHeader } from '../../../ui/page-header/page-header';
import { MapPreview } from '../../../ui/map-preview/map-preview';
import { mapCoordinates } from '../../../ui/map-preview/location-map';
import {
  MeasurementWorkspace,
  type MeasurementChannel,
  type MeasurementRecord,
} from '../../../ui/measurement-workspace/measurement-workspace';
import {
  PointExplorer,
  type PointExplorerEndpoints,
  type PointExplorerFact,
  type PointExplorerRow,
} from '../../../ui/point-explorer/point-explorer';
import { SourceContext } from '../../../ui/source-context/source-context';
import bg from './bg.json';
import en from './en.json';
import { ScenariosApi } from './scenarios-api';
import { karmaCarReturnQuery } from '../../karma-client/car-header/karma-car-context';
import { diagnosticJourneyQuery, journeyDiagnosticsLink } from '../diagnostics/diagnostic-journey';

type Scenario = AdminFleetScenarioQuery['fleetScenario'];
type Trip = Scenario['trips'][number];
type Signal = Scenario['signalSamples'][number];
const measurementSignals: readonly Signal['signal'][] = [
  'SPEED',
  'COOLANT_TEMPERATURE',
  'EXTERNAL_VOLTAGE',
  'FUEL_USED',
  'DISTANCE_COUNTER',
  'ENGINE_HOURS',
];
const signalUnits: Record<Signal['signal'], Signal['unit']> = {
  SPEED: 'KILOMETRES_PER_HOUR',
  COOLANT_TEMPERATURE: 'CELSIUS',
  EXTERNAL_VOLTAGE: 'VOLT',
  FUEL_USED: 'LITRE',
  DISTANCE_COUNTER: 'KILOMETRE',
  ENGINE_HOURS: 'HOUR',
};
const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  selector: 'holita-example-scenario-page',
  imports: [
    ButtonDirective,
    DayOverview,
    MapPreview,
    MeasurementWorkspace,
    PageHeader,
    PointExplorer,
    RouteDrawer,
    RouterLink,
    SourceContext,
  ],
  providers: [ScenariosApi],
  templateUrl: './example-scenario-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class ExampleScenarioPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  private readonly api = inject(ScenariosApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly reload = new Subject<void>();
  protected readonly scenario = signal<Scenario | null>(null);
  protected readonly loading = signal(true);
  private readonly error = signal<unknown>(null);
  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly failure = computed(() =>
    this.error() ? requestError(this.error(), this.text().loadError) : null,
  );
  protected readonly backLink = computed(() => ['/', this.language(), 'karma-client', 'cars']);
  protected readonly backQuery = computed(() => karmaCarReturnQuery(this.params()));
  protected readonly title = computed(
    () => this.scenario()?.vehicles[0]?.label ?? this.text().truck,
  );
  protected readonly selectedTrip = computed(() => {
    const fragment = this.fragment();
    const id =
      this.params().get('sampleTrip') ?? (fragment?.startsWith('trip-') ? fragment.slice(5) : null);
    return this.scenario()?.trips.find((trip) => trip.id === id) ?? null;
  });
  protected readonly diagnosticsLink = computed(() => {
    const scenario = this.scenario();
    const trip = this.selectedTrip();
    const vehicleId = trip?.vehicleId ?? scenario?.vehicles[0]?.id;
    const day = scenario
      ? isoToZonedWallTime(scenario.period.from, scenario.period.timeZone)?.slice(0, 10)
      : null;
    return scenario && vehicleId && day
      ? journeyDiagnosticsLink(this.router, this.branchId(), this.language(), {
          source: 'HOLITA_SCENARIO',
          vehicleId,
          day,
          timeZone: scenario.period.timeZone,
          from: trip?.startedAt ?? scenario.period.from,
          to: trip?.stoppedAt ?? scenario.period.toExclusive,
          tripId: trip?.id ?? null,
          query: diagnosticJourneyQuery(this.params()),
        })
      : null;
  });
  private readonly selectedPositions = computed(() => {
    const scenario = this.scenario();
    const trip = this.selectedTrip();
    return scenario && trip
      ? scenario.positionSamples.filter(
          (point) => point.tripId === trip.id && point.vehicleId === trip.vehicleId,
        )
      : null;
  });
  protected readonly explorerPoints = computed<readonly PointExplorerRow[] | null>(
    () =>
      this.selectedPositions()?.map((point) => ({
        key: `HOLITA_SCENARIO:${point.id}`,
        source: point.provenance.source,
        id: point.id,
        sourceTime: point.provenance.eventAt,
        instantUtc: point.provenance.eventAt,
        coordinates: mapCoordinates(point.latitude, point.longitude),
        provenance: point.provenance,
        facts: this.pointFacts(point),
      })) ?? null,
  );
  protected readonly measurementsMode = computed(
    () => this.params().get('sampleView') === 'measurements',
  );
  protected readonly selectedChannelKey = computed(() => this.params().get('sampleChannel'));
  protected readonly measurementChannels = computed<readonly MeasurementChannel[]>(() =>
    measurementSignals.map((kind) => ({
      key: kind,
      id: kind,
      label: this.text().signals[kind],
      unit: this.text().units[signalUnits[kind]],
      unitConfirmed: true,
      limitation: kind === 'FUEL_USED' ? this.text().fuelReset : null,
    })),
  );
  protected readonly measurementRecords = computed<readonly MeasurementRecord[] | null>(
    () =>
      this.selectedPositions()?.map((point) => ({
        key: `HOLITA_SCENARIO:${point.id}`,
        source: point.provenance.source,
        id: point.id,
        sourceTime: point.provenance.eventAt,
        instantUtc: point.provenance.eventAt,
        coordinates: mapCoordinates(point.latitude, point.longitude),
        provenance: point.provenance,
        readings: this.signalsFor(point).map((sample) => ({
          channelKey: sample.signal,
          id: sample.id,
          value: sample.value,
          description: sample.value === null ? this.text().unavailableSignal : null,
          provenance: sample.provenance,
        })),
      })) ?? null,
  );
  protected readonly measurementScope = computed(() => {
    const trip = this.selectedTrip();
    return trip
      ? `${trip.id} · ${trip.startedAt} – ${trip.stoppedAt} · ${String(this.selectedPositions()?.length ?? 0)} ${this.text().loadedTripPositions}`
      : this.text().tripDetails;
  });
  protected readonly counterComparison = computed(() => {
    const scenario = this.scenario();
    const trip = this.selectedTrip();
    if (!scenario || trip?.id !== 'example-trip-01') {
      return null;
    }
    const start = this.measurementRecords()?.find((row) => row.id === 'example-position-01');
    const stop = this.measurementRecords()?.find((row) => row.id === 'example-position-03');
    if (!start?.instantUtc || !stop?.instantUtc) {
      return null;
    }
    const from = Date.parse(start.instantUtc);
    const to = Date.parse(stop.instantUtc);
    const crossesGap = scenario.coverage.gaps.some(
      (gap) => Date.parse(gap.from) < to && Date.parse(gap.toExclusive) > from,
    );
    if (crossesGap) {
      return null;
    }
    const fuel = this.counterDelta(start, stop, 'FUEL_USED');
    const distance = this.counterDelta(start, stop, 'DISTANCE_COUNTER');
    const engineHours = this.counterDelta(start, stop, 'ENGINE_HOURS');
    if (!fuel || !distance || !engineHours || distance.value <= 0) {
      return null;
    }
    const provenance: FleetEvidenceFragment = {
      ...scenario.provenance,
      origin: 'DERIVED',
      sourceRecordId: null,
      eventAt: stop.instantUtc,
    };
    return {
      start,
      stop,
      provenance,
      counters: [fuel, distance, engineHours],
      consumption: (fuel.value / distance.value) * 100,
    };
  });
  protected readonly selectedPointKey = computed(() => {
    const id = this.params().get('samplePoint');
    return id ? `HOLITA_SCENARIO:${id}` : null;
  });
  protected readonly explorerEndpoints = computed<PointExplorerEndpoints>(() => {
    const trip = this.selectedTrip();
    const origin = trip ? this.point(trip.startPositionId) : null;
    const destination = trip ? this.point(trip.stopPositionId) : null;
    return {
      origin: mapCoordinates(origin?.latitude, origin?.longitude),
      destination: mapCoordinates(destination?.latitude, destination?.longitude),
      originTime: trip?.startedAt ?? null,
      destinationTime: trip?.stoppedAt ?? null,
    };
  });
  protected readonly firstTrip = computed(() => this.scenario()?.trips[0] ?? null);
  protected readonly provenance = computed<FleetEvidenceFragment | null>(() => {
    const scenario = this.scenario();
    return scenario ? { ...scenario.provenance, origin: 'DERIVED' } : null;
  });
  private readonly totalDistance = computed(
    () =>
      this.scenario()?.trips.reduce<number | null>(
        (total, trip) =>
          total === null || trip.distance.value == null ? null : total + trip.distance.value,
        0,
      ) ?? null,
  );
  protected readonly distance = computed<DayMetricView | null>(() =>
    this.scenario()
      ? {
          value:
            this.totalDistance() === null
              ? null
              : formatNumber(this.totalDistance(), this.language(), { fraction: 1 }),
          unit: this.text().distanceUnit,
          context: this.text().sameDay,
          explanation: this.text().distanceExplanation,
        }
      : null,
  );
  protected readonly tripCount = computed<DayMetricView | null>(() => {
    const scenario = this.scenario();
    return scenario
      ? {
          value: formatNumber(scenario.trips.length, this.language()),
          unit: null,
          context: this.text().sameDay,
          explanation: this.text().tripCountExplanation,
        }
      : null;
  });
  protected readonly maximumSpeed = computed<DayMetricView | null>(() => {
    const scenario = this.scenario();
    if (!scenario) {
      return null;
    }
    const values = scenario.trips.flatMap((trip) =>
      trip.maximumSpeed.value == null ? [] : [trip.maximumSpeed.value],
    );
    return {
      value: values.length ? formatNumber(Math.max(...values), this.language()) : null,
      unit: this.text().speedUnit,
      context: this.text().sameDay,
      explanation: this.text().speedExplanation,
    };
  });
  protected readonly composition = computed<readonly StackedRow[]>(() => {
    const scenario = this.scenario();
    const total = this.totalDistance();
    if (!scenario || total === null) {
      return [];
    }
    const night = scenario.trips.reduce<number | null>(
      (sum, trip) =>
        sum === null || trip.nightDistance.value == null ? null : sum + trip.nightDistance.value,
      0,
    );
    return night === null
      ? []
      : [
          {
            key: scenario.id,
            label: this.text().sameDay,
            total,
            totalText: `${formatNumber(total, this.language(), { fraction: 1 })} ${this.text().distanceUnit}`,
            segments: [
              { key: 'day', value: total - night, tone: 'c1' },
              { key: 'night', value: night, tone: 'c2' },
            ],
          },
        ];
  });
  protected readonly trips = computed<readonly DayTripRow[] | null>(
    () =>
      this.scenario()?.trips.map((trip) => ({
        id: trip.id,
        start: this.time(trip.startedAt),
        stop: this.time(trip.stoppedAt),
        distance: this.distanceText(trip),
      })) ?? null,
  );

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.watch('operational-day-v1').valueChanges.pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete') {
          this.scenario.set(result.data.fleetScenario);
        }
      });
  }

  protected refresh(): void {
    this.reload.next();
  }

  protected openTrip(id: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: `trip-${id}`,
      queryParams: { sampleTrip: id, samplePoint: null },
      queryParamsHandling: 'merge',
    });
  }

  protected closeTrip(): void {
    const fragment = this.fragment();
    void this.router.navigate([], {
      relativeTo: this.route,
      fragment: fragment?.startsWith('trip-') ? '' : (fragment ?? ''),
      queryParams: { sampleTrip: null, samplePoint: null, sampleView: null, sampleChannel: null },
      queryParamsHandling: 'merge',
    });
  }

  protected selectPoint(key: string | null): void {
    const trip = this.selectedTrip();
    const point = this.explorerPoints()?.find((row) => row.key === key);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sampleTrip: trip?.id ?? null, samplePoint: point?.id ?? null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected selectView(measurements: boolean): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sampleView: measurements ? 'measurements' : null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected selectChannel(key: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sampleChannel: key },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  private counterDelta(start: MeasurementRecord, stop: MeasurementRecord, kind: Signal['signal']) {
    const first = start.readings.find((reading) => reading.channelKey === kind);
    const last = stop.readings.find((reading) => reading.channelKey === kind);
    if (first?.value == null || last?.value == null || last.value < first.value) {
      return null;
    }
    return {
      key: kind,
      label: this.text().signals[kind],
      unit: this.text().units[signalUnits[kind]],
      first,
      last,
      value: last.value - first.value,
    };
  }

  private signalsFor(point: Scenario['positionSamples'][number]): readonly Signal[] {
    return (this.scenario()?.signalSamples ?? []).filter(
      (sample) =>
        sample.positionSampleId === point.id &&
        sample.tripId === point.tripId &&
        sample.vehicleId === point.vehicleId,
    );
  }

  private pointFacts(point: Scenario['positionSamples'][number]): readonly PointExplorerFact[] {
    return this.signalsFor(point).map((sample) => ({
      label: this.text().signals[sample.signal],
      value:
        sample.value == null
          ? this.text().unavailableSignal
          : `${formatNumber(sample.value, this.language(), { fraction: 1 })} ${this.text().units[sample.unit]}`,
    }));
  }

  protected number(value: number | null, fraction = 1): string {
    return formatNumber(value, this.language(), { fraction });
  }

  protected point(id: string) {
    return this.scenario()?.positionSamples.find((sample) => sample.id === id) ?? null;
  }

  protected time(value: string | null | undefined): string {
    return formatDateTime(
      value,
      this.language(),
      this.scenario()?.period.timeZone ?? 'Europe/Sofia',
      true,
    );
  }

  protected distanceText(trip: Trip): string {
    const value = trip.distance.value;
    return value == null
      ? '—'
      : `${formatNumber(value, this.language(), { fraction: 1 })} ${this.text().distanceUnit}`;
  }

  protected speedText(trip: Trip): string {
    const value = trip.maximumSpeed.value;
    return value == null ? '—' : `${formatNumber(value, this.language())} ${this.text().speedUnit}`;
  }
}
