import type {
  AdminKarmaPositionSamplesQuery,
  KarmaTripFieldsFragment,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { dailyReportMessages, type DailyReportResult } from './daily-report-presentation';
import bg from './report-evidence.bg.json';
import en from './report-evidence.en.json';

type PositionResult = AdminKarmaPositionSamplesQuery['karmaPositionSamples'];
type Metric = DailyReportResult['totalDistance'];
const catalogs: Record<Language, typeof en> = { bg, en };
const metricKeys = [
  'tripCount',
  'totalDistance',
  'dayDistance',
  'nightDistance',
  'maxSpeed',
] as const;

export interface ReportComparisonRow {
  readonly key: (typeof metricKeys)[number];
  readonly label: string;
  readonly unit: string;
  readonly selected: string;
  readonly baseline: string;
  readonly difference: string | null;
  readonly percent: string | null;
  readonly reason: string | null;
}

function number(value: number | null, language: Language): string {
  return formatNumber(value, language, { significantDigits: 15 });
}

function comparisonGate(
  selected: DailyReportResult,
  baseline: DailyReportResult,
  language: Language,
) {
  const text = catalogs[language];
  if (!selected.day || !baseline.day || selected.day === baseline.day) {
    return text.daysGate;
  }
  if (selected.carId !== baseline.carId) {
    return text.carGate;
  }
  if (
    !selected.timeZone ||
    !baseline.timeZone ||
    selected.timeZone.id !== baseline.timeZone.id ||
    selected.timeZone.name !== baseline.timeZone.name
  ) {
    return text.zoneGate;
  }
  const complete = (report: DailyReportResult) =>
    report.retrieval === 'COMPLETE' && (report.state === 'COMPLETE' || report.state === 'EMPTY');
  return complete(selected) && complete(baseline) ? null : text.completionGate;
}

export function reportComparison(
  selected: DailyReportResult,
  baseline: DailyReportResult,
  language: Language,
): readonly ReportComparisonRow[] {
  const text = catalogs[language];
  const labels = dailyReportMessages[language];
  const gate = comparisonGate(selected, baseline, language);
  return metricKeys.map((key) => {
    const left = selected[key];
    const right = baseline[key];
    const sameUnit = left.unit === right.unit;
    const row = {
      key,
      label: labels[key],
      unit: sameUnit
        ? labels.units[left.unit]
        : `${labels.units[left.unit]} / ${labels.units[right.unit]}`,
      selected: number(left.value, language),
      baseline: number(right.value, language),
    };
    if (gate || !sameUnit) {
      return { ...row, difference: null, percent: null, reason: gate ?? text.unitGate };
    }
    if (
      left.availability !== 'COMPLETE' ||
      right.availability !== 'COMPLETE' ||
      left.value === null ||
      right.value === null ||
      !Number.isFinite(left.value) ||
      !Number.isFinite(right.value)
    ) {
      return { ...row, difference: null, percent: null, reason: text.metricGate };
    }
    const difference = left.value - right.value;
    return {
      ...row,
      difference: number(difference, language),
      percent:
        right.value === 0
          ? null
          : `${formatNumber((difference / right.value) * 100, language, { fraction: 2 })}%`,
      reason: right.value === 0 ? text.zeroBaseline : null,
    };
  });
}

export function reportBrief(report: DailyReportResult, language: Language): readonly string[] {
  const text = catalogs[language];
  const labels = dailyReportMessages[language];
  const rules = {
    tripCount: labels.tripCountFormula,
    totalDistance: `${labels.totalDistanceFormula} trip_distance.`,
    dayDistance: labels.dayDistanceFormula,
    nightDistance: `${labels.nightDistanceFormula} trip_distance_night.`,
    maxSpeed: `${labels.maxSpeedFormula} max_speed.`,
  };
  return [
    interpolate(text.daySource, {
      carId: report.carId,
      day: report.day ?? text.unestablished,
      zone: report.timeZone?.name ?? text.unestablished,
    }),
    interpolate(text.period, {
      fromLocal: report.fromLocal ?? '—',
      toLocal: report.toLocalExclusive ?? '—',
      fromUtc: report.fromUtc ?? '—',
      toUtc: report.toUtcExclusive ?? '—',
    }),
    interpolate(text.completion, {
      state: labels.states[report.state],
      retrieval: labels.retrievalStates[report.retrieval],
      reason: labels.reasons[report.reason],
    }).trim(),
    ...metricKeys.map((key) => {
      const metric = report[key];
      return `${interpolate(text.metric, {
        label: labels[key],
        value: number(metric.value, language),
        unit: labels.units[metric.unit],
        availability: labels.availability[metric.availability],
        available: metric.availableInputs,
        required: metric.requiredInputs,
      })} ${rules[key]}`;
    }),
    text.selectionRule,
    labels.unitsHint,
    text.coverageRule,
  ];
}

function selectedSample(result: PositionResult | null, selectedKey: string | null) {
  return result?.samples.find((sample) => `KARMA_API:${sample.event.id}` === selectedKey) ?? null;
}

function selectedEndpoint(trip: KarmaTripFieldsFragment, selectedKey: string | null) {
  if (selectedKey === `start:${trip.id}`) {
    return { kind: 'start' as const, id: trip.startMessageId, sourceTime: trip.startDate };
  }
  return selectedKey === `stop:${trip.id}`
    ? { kind: 'stop' as const, id: trip.stopMessageId, sourceTime: trip.stopDate }
    : null;
}

export function tripPointBrief(
  trip: KarmaTripFieldsFragment,
  result: PositionResult | null,
  selectedKey: string | null,
  language: Language,
): readonly string[] {
  const text = catalogs[language];
  const lines = [
    interpolate(text.tripSource, { carId: trip.carId, tripId: trip.id }),
    interpolate(text.tripTimes, { start: trip.startDate ?? '—', stop: trip.stopDate ?? '—' }),
    interpolate(text.tripMetrics, {
      distance: number(trip.tripDistance, language),
      nightDistance: number(trip.tripDistanceNight, language),
      maxSpeed: number(trip.maxSpeed, language),
    }),
  ];
  if (result) {
    lines.push(
      interpolate(text.positionRead, {
        retrieval: dailyReportMessages[language].retrievalStates[result.retrieval],
        reason: result.reason,
        loaded: result.loadedRows,
        maxRows: result.maxRows,
        deadlineMs: result.deadlineMs,
        retrievedAt: result.retrievedAt,
      }),
      interpolate(text.positionBoundaries, {
        startId: result.startMessageId,
        stopId: result.stopMessageId,
        startPresent: result.startMessagePresent ? text.present : text.absent,
        stopPresent: result.stopMessagePresent ? text.present : text.absent,
        duplicates: result.duplicateIdsRemoved,
      }),
      interpolate(text.positionClock, { ordering: text.ordering[result.ordering] }),
    );
  } else {
    lines.push(text.positionsNotLoaded);
  }
  const sample = selectedSample(result, selectedKey);
  const endpoint = selectedEndpoint(trip, selectedKey);
  if (sample) {
    lines.push(
      interpolate(text.selectedPoint, {
        id: sample.event.id,
        sourceTime: sample.event.edt ?? '—',
        instantUtc: sample.instantUtc ?? text.unestablished,
        speed: number(sample.event.spd, language),
        odometer: number(sample.event.odo, language),
      }),
    );
  } else if (endpoint) {
    lines.push(
      interpolate(text.selectedEndpoint, {
        kind: text[endpoint.kind],
        id: endpoint.id ?? '—',
        sourceTime: endpoint.sourceTime ?? '—',
      }),
    );
  } else if (selectedKey !== null) {
    lines.push(text.selectedMissing);
  }
  return lines;
}

function metricEvidence(metric: Metric) {
  return {
    value: metric.value,
    availability: metric.availability,
    unit: metric.unit,
    availableInputs: metric.availableInputs,
    requiredInputs: metric.requiredInputs,
  };
}

function tripEvidence(
  trip: KarmaTripFieldsFragment,
  includeCoordinates: boolean,
  retrievedAt: string | null = null,
) {
  return {
    id: trip.id,
    carId: trip.carId,
    tripActive: trip.tripActive,
    provenance: {
      origin: 'OBSERVED',
      source: 'KARMA_API',
      scenarioId: null,
      sourceRecordId: trip.id,
      eventAt: null,
      receivedAt: null,
      retrievedAt,
    },
    startMessageId: trip.startMessageId,
    startDate: trip.startDate,
    stopMessageId: trip.stopMessageId,
    stopDate: trip.stopDate,
    tripDistance: trip.tripDistance,
    tripDistanceNight: trip.tripDistanceNight,
    maxSpeed: trip.maxSpeed,
    tripDuration: trip.tripDuration,
    tripDurationNight: trip.tripDurationNight,
    startOdo: trip.startOdo,
    stopOdo: trip.stopOdo,
    unitsConfirmed: false,
    ...(includeCoordinates
      ? {
          startLatitude: trip.startLatitude,
          startLongitude: trip.startLongitude,
          stopLatitude: trip.stopLatitude,
          stopLongitude: trip.stopLongitude,
        }
      : {}),
  };
}

function reportPeriod(report: DailyReportResult) {
  return {
    day: report.day,
    timeZone: report.timeZone ? { id: report.timeZone.id, name: report.timeZone.name } : null,
    fromLocal: report.fromLocal,
    toLocalExclusive: report.toLocalExclusive,
    fromUtc: report.fromUtc,
    toUtcExclusive: report.toUtcExclusive,
  };
}

function reportCompletion(report: DailyReportResult) {
  return {
    retrieval: report.retrieval,
    state: report.state,
    reason: report.reason,
    positionCoverage: report.positionCoverage,
  };
}

function reportProvenance(report: DailyReportResult) {
  return {
    origin:
      report.state === 'UNAVAILABLE' || report.state === 'UNSUPPORTED_PERIOD'
        ? 'UNAVAILABLE'
        : 'DERIVED',
    source: 'KARMA_API',
    scenarioId: null,
    sourceRecordId: null,
    eventAt: null,
    receivedAt: null,
    retrievedAt: report.retrievedAt,
  };
}

function reportEvidence(report: DailyReportResult, includeCoordinates: boolean) {
  return {
    carId: report.carId,
    selection: report.selection,
    period: reportPeriod(report),
    provenance: reportProvenance(report),
    completion: reportCompletion(report),
    retrievedAt: report.retrievedAt,
    loadedTrips: report.loadedTrips,
    pageRequests: report.pageRequests,
    maxPages: report.maxPages,
    maxRows: report.maxRows,
    deadlineMs: report.deadlineMs,
    metrics: {
      tripCount: metricEvidence(report.tripCount),
      totalDistance: metricEvidence(report.totalDistance),
      dayDistance: metricEvidence(report.dayDistance),
      nightDistance: metricEvidence(report.nightDistance),
      maxSpeed: metricEvidence(report.maxSpeed),
    },
    trips: report.trips.map((trip) => tripEvidence(trip, includeCoordinates, report.retrievedAt)),
  };
}

export function dayEvidence(
  selected: DailyReportResult,
  baseline: DailyReportResult | null,
  language: Language,
  includeCoordinates: boolean,
) {
  return {
    version: 1,
    mode: 'KARMA_API',
    source: 'KARMA_API',
    provenance: reportProvenance(selected),
    exportedAt: new Date().toISOString(),
    language,
    coordinatesIncluded: includeCoordinates,
    selection: {
      carId: selected.carId,
      day: selected.day,
      baselineDay: baseline?.day ?? null,
      rule: selected.selection,
    },
    period: reportPeriod(selected),
    retrievedAt: selected.retrievedAt,
    completion: reportCompletion(selected),
    report: reportEvidence(selected, includeCoordinates),
    baseline: baseline ? reportEvidence(baseline, includeCoordinates) : null,
    brief: reportBrief(selected, language),
    comparison: baseline ? reportComparison(selected, baseline, language) : [],
  };
}

export function tripPointEvidence(
  trip: KarmaTripFieldsFragment,
  result: PositionResult | null,
  selectedKey: string | null,
  language: Language,
  includeCoordinates: boolean,
  positionReadFailed: boolean,
) {
  const sample = selectedSample(result, selectedKey);
  const endpoint = selectedEndpoint(trip, selectedKey);
  return {
    version: 1,
    mode: 'KARMA_API',
    source: 'KARMA_API',
    provenance: {
      origin: 'OBSERVED',
      source: 'KARMA_API',
      scenarioId: null,
      sourceRecordId: trip.id,
      eventAt: null,
      receivedAt: null,
      retrievedAt: null,
    },
    exportedAt: new Date().toISOString(),
    language,
    coordinatesIncluded: includeCoordinates,
    selection: {
      carId: trip.carId,
      tripId: trip.id,
      startMessageId: trip.startMessageId,
      stopMessageId: trip.stopMessageId,
      selectedKey,
    },
    period: {
      fromSourceText: trip.startDate,
      toSourceText: trip.stopDate,
      sourceClock: 'UNRESOLVED_TRIP_SOURCE_TEXT',
      timeZone: null,
      fromUtc: null,
      toUtc: null,
    },
    retrievedAt: result?.retrievedAt ?? null,
    retrievedAtScope: 'POSITION_READ',
    completion: {
      tripActive: trip.tripActive,
      stopDate: trip.stopDate,
      retrieval: result?.retrieval ?? (positionReadFailed ? 'UNAVAILABLE' : 'NOT_STARTED'),
      reason: result?.reason ?? null,
      positionCoverage: 'NOT_ASSESSED',
    },
    trip: tripEvidence(trip, includeCoordinates),
    positionRead: result
      ? {
          carId: result.carId,
          startMessageId: result.startMessageId,
          stopMessageId: result.stopMessageId,
          retrieval: result.retrieval,
          reason: result.reason,
          retrievedAt: result.retrievedAt,
          positionCoverage: result.positionCoverage,
          sourceClock: result.sourceClock,
          ordering: result.ordering,
          startMessagePresent: result.startMessagePresent,
          stopMessagePresent: result.stopMessagePresent,
          loadedRows: result.loadedRows,
          maxRows: result.maxRows,
          deadlineMs: result.deadlineMs,
          duplicateIdsRemoved: result.duplicateIdsRemoved,
        }
      : null,
    selectedSample: sample
      ? {
          id: sample.event.id,
          carId: sample.event.carId,
          eventId: sample.event.eventId,
          edt: sample.event.edt,
          edtTz: sample.event.edtTz,
          instantUtc: sample.instantUtc,
          spd: sample.event.spd,
          odo: sample.event.odo,
          unitsConfirmed: false,
          provenance: {
            origin: 'OBSERVED',
            source: 'KARMA_API',
            scenarioId: null,
            sourceRecordId: sample.event.id,
            eventAt: sample.instantUtc,
            receivedAt: null,
            retrievedAt: result?.retrievedAt ?? null,
          },
          ...(includeCoordinates
            ? { latitude: sample.event.latitude, longitude: sample.event.longitude }
            : {}),
        }
      : null,
    selectedEndpoint: endpoint
      ? {
          kind: endpoint.kind,
          id: endpoint.id,
          sourceTime: endpoint.sourceTime,
          instantUtc: null,
          provenance: {
            origin: 'OBSERVED',
            source: 'KARMA_API',
            scenarioId: null,
            sourceRecordId: endpoint.id,
            eventAt: null,
            receivedAt: null,
            retrievedAt: null,
          },
        }
      : null,
    brief: tripPointBrief(trip, result, selectedKey, language),
  };
}
