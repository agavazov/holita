import type {
  KarmaDailyReport,
  KarmaDailyReportMetric,
  KarmaDailyReportMetricUnit,
  KarmaTrip,
} from '../../generated/graphql/types.js';
import { dailyReportLimits } from './daily-report-query.js';

function unavailableMetric(unit: KarmaDailyReportMetricUnit): KarmaDailyReportMetric {
  return { value: null, availability: 'UNAVAILABLE', availableInputs: 0, requiredInputs: 0, unit };
}

export function initialDailyReport(carId: string, day: string | null): KarmaDailyReport {
  return {
    carId,
    car: null,
    day,
    timeZone: null,
    fromLocal: null,
    toLocalExclusive: null,
    fromUtc: null,
    toUtcExclusive: null,
    selection: 'STARTED_IN_DAY',
    retrieval: 'NOT_STARTED',
    state: 'UNAVAILABLE',
    reason: 'NONE',
    pageRequests: 0,
    loadedTrips: 0,
    trips: [],
    ...dailyReportLimits,
    positionCoverage: 'NOT_ASSESSED',
    retrievedAt: new Date().toISOString(),
    tripCount: unavailableMetric('COUNT'),
    totalDistance: unavailableMetric('SOURCE_DISTANCE_UNCONFIRMED'),
    nightDistance: unavailableMetric('SOURCE_DISTANCE_UNCONFIRMED'),
    dayDistance: unavailableMetric('SOURCE_DISTANCE_UNCONFIRMED'),
    maxSpeed: unavailableMetric('SOURCE_SPEED_UNCONFIRMED'),
  };
}

export function dailyReportResult(report: KarmaDailyReport, trips: KarmaTrip[]): KarmaDailyReport {
  report.retrievedAt = new Date().toISOString();
  report.loadedTrips = trips.length;
  report.trips = trips;
  if (report.retrieval !== 'COMPLETE' && report.retrieval !== 'PARTIAL') {
    return report;
  }
  const openTrips = trips.some((trip) => trip.tripActive !== 0 || !trip.stopDate);
  const final = report.retrieval === 'COMPLETE' && !openTrips;
  const metric = (
    values: number[],
    unit: KarmaDailyReportMetricUnit,
    maximum = false,
  ): KarmaDailyReportMetric => {
    const value = values.length
      ? maximum
        ? Math.max(...values)
        : values.reduce((sum, item) => sum + item, 0)
      : !maximum && trips.length === 0 && final
        ? 0
        : null;
    return {
      value,
      availability:
        value === null
          ? 'UNAVAILABLE'
          : final && values.length === trips.length
            ? 'COMPLETE'
            : 'PARTIAL',
      availableInputs: values.length,
      requiredInputs: trips.length,
      unit,
    };
  };
  const totals = trips.flatMap((trip) =>
    trip.tripDistance === null || trip.tripDistance === undefined ? [] : [trip.tripDistance],
  );
  const nights = trips.flatMap((trip) =>
    trip.tripDistanceNight === null || trip.tripDistanceNight === undefined
      ? []
      : [trip.tripDistanceNight],
  );
  report.tripCount = {
    value: trips.length,
    availability: report.retrieval === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL',
    availableInputs: trips.length,
    requiredInputs: trips.length,
    unit: 'COUNT',
  };
  report.totalDistance = metric(totals, 'SOURCE_DISTANCE_UNCONFIRMED');
  report.nightDistance = metric(nights, 'SOURCE_DISTANCE_UNCONFIRMED');
  report.maxSpeed = metric(
    trips.flatMap((trip) =>
      trip.maxSpeed === null || trip.maxSpeed === undefined ? [] : [trip.maxSpeed],
    ),
    'SOURCE_SPEED_UNCONFIRMED',
    true,
  );
  const pairedInputs = trips.filter(
    (trip) =>
      trip.tripDistance !== null &&
      trip.tripDistance !== undefined &&
      trip.tripDistanceNight !== null &&
      trip.tripDistanceNight !== undefined,
  ).length;
  report.dayDistance = {
    value:
      pairedInputs === trips.length &&
      report.totalDistance.value !== null &&
      report.totalDistance.value !== undefined &&
      report.nightDistance.value !== null &&
      report.nightDistance.value !== undefined
        ? report.totalDistance.value - report.nightDistance.value
        : null,
    availability:
      pairedInputs !== trips.length || (trips.length === 0 && !final)
        ? 'UNAVAILABLE'
        : final
          ? 'COMPLETE'
          : 'PARTIAL',
    availableInputs: pairedInputs,
    requiredInputs: trips.length,
    unit: 'SOURCE_DISTANCE_UNCONFIRMED',
  };
  if (report.retrieval === 'COMPLETE') {
    if (!trips.length) {
      report.state = 'EMPTY';
    } else if (openTrips) {
      report.state = 'PARTIAL';
      report.reason = 'OPEN_TRIPS';
    } else {
      report.state = [report.totalDistance, report.nightDistance, report.maxSpeed].every(
        (value) => value.availability === 'COMPLETE',
      )
        ? 'COMPLETE'
        : 'PARTIAL';
    }
  }
  return report;
}
