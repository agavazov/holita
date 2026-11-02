import type {
  AdminKarmaDailyReportQuery,
  FleetEvidenceFragment,
  FleetEvidencePeriodFragment,
  FleetScenarioCoverageFragment,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import type { StackedRow } from '../../../ui/charts/stacked-bars';
import type { DayMetricView, DayTripRow } from '../../../ui/day-overview/day-overview';
import { formatNumber } from '../../../ui/format/format';
import bg from './bg.json';
import en from './en.json';

export type DailyReportResult = AdminKarmaDailyReportQuery['karmaDailyReport'];
export const dailyReportMessages: Record<Language, typeof en> = { bg, en };

/** Formats the server's selected dataset; it never calculates totals from table pages. */
export function dailyReportPresentation(report: DailyReportResult, language: Language) {
  const text = dailyReportMessages[language];
  const metric = (
    value: DailyReportResult['totalDistance'],
    explanation: string,
  ): DayMetricView => ({
    value:
      value.value === null ? null : formatNumber(value.value, language, { significantDigits: 15 }),
    unit: text.units[value.unit],
    context: `${text.availability[value.availability]} · ${String(value.availableInputs)}/${String(value.requiredInputs)}`,
    explanation: `${explanation} ${text.missingHint} ${value.unit === 'COUNT' ? '' : text.unitsHint}`,
  });
  const provenance: FleetEvidenceFragment = {
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
  const period: FleetEvidencePeriodFragment | null =
    report.fromUtc && report.toUtcExclusive && report.timeZone
      ? { from: report.fromUtc, toExclusive: report.toUtcExclusive, timeZone: report.timeZone.name }
      : null;
  const coverage: FleetScenarioCoverageFragment = {
    retrieval: report.retrieval,
    positionCoverage: report.positionCoverage,
    positionsLoaded: 0,
    gaps: [],
  };
  const { dayDistance, nightDistance, totalDistance } = report;
  const completeComposition = [dayDistance, nightDistance, totalDistance].every(
    (value) => value.availability === 'COMPLETE',
  );
  const composition: readonly StackedRow[] =
    completeComposition &&
    dayDistance.value !== null &&
    nightDistance.value !== null &&
    totalDistance.value !== null
      ? [
          {
            key: 'day',
            label: text.dayComposition,
            total: totalDistance.value,
            totalText: `${formatNumber(totalDistance.value, language, { significantDigits: 15 })} ${text.units[totalDistance.unit]}`,
            segments: [
              { key: 'day', value: dayDistance.value, tone: 'c1' },
              { key: 'night', value: nightDistance.value, tone: 'c2' },
            ],
          },
        ]
      : [];
  const trips: readonly DayTripRow[] = report.trips.map((trip) => ({
    id: trip.id,
    start: trip.startDate ?? '—',
    stop: trip.stopDate ?? '—',
    distance:
      trip.tripDistance === null
        ? '—'
        : formatNumber(trip.tripDistance, language, { significantDigits: 15 }),
  }));
  return {
    provenance,
    period,
    coverage,
    distance: metric(report.totalDistance, `${text.totalDistanceFormula} trip_distance.`),
    tripCount: metric(report.tripCount, text.tripCountFormula),
    maximumSpeed: metric(report.maxSpeed, `${text.maxSpeedFormula} max_speed.`),
    composition,
    compositionHint: composition.length ? text.unitsHint : text.compositionUnavailable,
    trips,
    status: text.states[report.state],
    hint: report.reason === 'NONE' ? null : text.reasons[report.reason],
  };
}
