import type {
  AdminTripDetailsFragment,
  AdminTripSummaryQuery,
  FleetEventKind,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { alertsText } from '../alerts/i18n/messages';
import type { TripKpis, TripRow } from './trips-view';

/** Shared by real trip lists, record tabs and Overview; never fabricates timeline entries. */
export function tripRow(trip: AdminTripDetailsFragment, language: Language): TripRow {
  const kinds: Record<FleetEventKind, string> = alertsText(language).kinds;
  return {
    id: trip.id,
    vehicleId: trip.vehicleId,
    plate: trip.vehicle.licensePlate,
    driverId: trip.driverId,
    driverName: trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : null,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    from: trip.startAddress,
    to: trip.endAddress,
    distanceKm: trip.distanceKm,
    durationMin: trip.durationSeconds === null ? null : trip.durationSeconds / 60,
    maxSpeedKph: trip.maxSpeedKph,
    inProgress: trip.inProgress,
    fuelUsedL: trip.fuelUsedL,
    score: trip.drivingScore,
    events: trip.drivingEvents.map((event) => ({
      id: event.id,
      at: event.occurredAt,
      kind: kinds[event.kind],
      detail: event.details ?? '',
      tone:
        event.severity === 'CRITICAL' ? 'danger' : event.severity === 'WARNING' ? 'warn' : 'info',
    })),
  };
}
export function tripKpis(summary: AdminTripSummaryQuery['fleetTripSummary']): TripKpis {
  return {
    trips: summary.totalTrips,
    distanceKm: summary.distanceKm,
    drivingMin: summary.totalDurationSeconds / 60,
    averageScore: summary.averageDrivingScore,
    events: summary.totalManeuverEvents,
  };
}
