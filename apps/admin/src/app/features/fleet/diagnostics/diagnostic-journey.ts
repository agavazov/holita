import { convertToParamMap, type ParamMap, type Router } from '@angular/router';
import type { FleetEvidenceSource } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { karmaCarNavigationContext } from '../../karma-client/car-header/karma-car-context';

export interface DiagnosticJourney {
  readonly source: FleetEvidenceSource;
  readonly vehicleId: string;
  readonly day: string;
  readonly timeZone: string;
  readonly from: string;
  readonly to: string;
  readonly tripId: string | null;
  readonly query: Readonly<Record<string, string>>;
}

const returnKeys = [
  'listQ',
  'listSize',
  'listFirst',
  'listProject',
  'compareDay',
  'samplePoint',
  'sampleView',
  'sampleChannel',
];

export function diagnosticJourneyQuery(params: ParamMap): Record<string, string> {
  const query: Record<string, string> = {};
  for (const key of returnKeys) {
    const value = params.getAll(key).length === 1 ? params.get(key) : null;
    if (value !== null) {
      query[key] = value;
    }
  }
  return query;
}

export function diagnosticJourney(params: ParamMap): DiagnosticJourney | null {
  try {
    const value: unknown = JSON.parse(params.get('truckContext') ?? 'null');
    if (
      typeof value !== 'object' ||
      value === null ||
      !('source' in value) ||
      (value.source !== 'KARMA_API' && value.source !== 'HOLITA_SCENARIO') ||
      !('vehicleId' in value) ||
      typeof value.vehicleId !== 'string' ||
      !('day' in value) ||
      typeof value.day !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.day) ||
      !('timeZone' in value) ||
      typeof value.timeZone !== 'string' ||
      !('from' in value) ||
      typeof value.from !== 'string' ||
      !('to' in value) ||
      typeof value.to !== 'string' ||
      !('tripId' in value) ||
      (value.tripId !== null && typeof value.tripId !== 'string') ||
      !('query' in value) ||
      typeof value.query !== 'object' ||
      value.query === null
    ) {
      return null;
    }
    const real = value.source === 'KARMA_API';
    const validId = (id: string) =>
      real ? /^[1-9]\d*$/.test(id) : /^example-[a-z0-9-]+$/.test(id);
    if (!validId(value.vehicleId) || (value.tripId !== null && !validId(value.tripId))) {
      return null;
    }
    const query: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value.query)) {
      if (returnKeys.includes(key) && typeof entry === 'string') {
        query[key] = entry;
      }
    }
    return {
      source: value.source,
      vehicleId: value.vehicleId,
      day: value.day,
      timeZone: value.timeZone,
      from: value.from,
      to: value.to,
      tripId: value.tripId,
      query,
    };
  } catch {
    return null;
  }
}

export function journeyDiagnosticsLink(
  router: Router,
  branchId: string,
  language: Language,
  journey: DiagnosticJourney,
) {
  return router.createUrlTree(['/', language, branchId, 'fleet', 'diagnostics', 'faults'], {
    queryParams: {
      source: journey.source,
      truckContext: JSON.stringify(journey),
      conditions: JSON.stringify([
        { id: 'vehicle', field: 'vehicle', operator: 'isAnyOf', values: [journey.vehicleId] },
        { id: 'day', field: 'observedOn', operator: 'on', values: [journey.day] },
        ...(journey.tripId
          ? [{ id: 'trip', field: 'trip', operator: 'isAnyOf', values: [journey.tripId] }]
          : []),
      ]),
    },
  });
}

export function journeyBackNavigation(
  journey: DiagnosticJourney,
  branchId: string,
  language: Language,
) {
  const query = karmaCarNavigationContext(convertToParamMap(journey.query));
  return journey.source === 'KARMA_API'
    ? {
        commands: ['/', language, 'karma-client', 'cars', journey.vehicleId],
        query: { ...query, day: journey.day, compareDay: journey.query['compareDay'] ?? null },
        fragment: journey.tripId ? `trip-${journey.tripId}` : null,
      }
    : {
        commands: ['/', language, branchId, 'fleet', 'scenarios', 'operational-day-v1'],
        query: {
          ...query,
          sampleTrip: journey.tripId,
          samplePoint: journey.query['samplePoint'] ?? null,
          sampleView: journey.query['sampleView'] === 'measurements' ? 'measurements' : null,
          sampleChannel: journey.query['sampleChannel'] ?? null,
        },
        fragment: null,
      };
}
