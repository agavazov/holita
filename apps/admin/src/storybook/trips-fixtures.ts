import {
  AdminTripDocument,
  AdminTripDriversDocument,
  AdminTripsDocument,
  AdminTripSummaryDocument,
  AdminTripVehiclesDocument,
  type AdminTripDetailsFragment,
} from '../generated/graphql/operations';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';
const driverId = '40000000-0000-4000-8000-000000000001';
export const fixtureTrip: WithTypename<AdminTripDetailsFragment> = {
  __typename: 'FleetTrip',
  id: '70000000-0000-4000-8000-000000000001',
  branchId: defaultBranchId,
  vehicleId: '50000000-0000-4000-8000-000000000001',
  vehicle: {
    __typename: 'FleetVehicleRef',
    id: '50000000-0000-4000-8000-000000000001',
    licensePlate: 'CB 1001 AX',
  },
  driverId,
  driver: { __typename: 'FleetDriverRef', id: driverId, firstName: 'Elena', lastName: 'Petrova' },
  startedAt: '2026-10-18T05:00:00.000Z',
  endedAt: '2026-10-18T06:00:00.000Z',
  durationSeconds: 3600,
  startAddress: 'Sofia',
  endAddress: 'Plovdiv',
  distanceKm: 150,
  maxSpeedKph: 90,
  fuelUsedL: 30,
  drivingScore: 80,
  inProgress: false,
  drivingEvents: [
    {
      __typename: 'FleetTripDrivingEvent',
      id: '60000000-0000-4000-8000-000000000011',
      occurredAt: '2026-10-18T05:10:00.000Z',
      kind: 'HARSH_BRAKING',
      severity: 'WARNING',
      details: 'Hard braking near the exit.',
    },
    {
      __typename: 'FleetTripDrivingEvent',
      id: '60000000-0000-4000-8000-000000000012',
      occurredAt: '2026-10-18T05:30:00.000Z',
      kind: 'SHARP_TURN',
      severity: 'CRITICAL',
      details: 'A sharp turn was recorded.',
    },
  ],
};
export const fixtureOpenTrip: WithTypename<AdminTripDetailsFragment> = {
  ...fixtureTrip,
  id: '70000000-0000-4000-8000-000000000002',
  startedAt: '2026-10-18T06:30:00.000Z',
  endedAt: null,
  durationSeconds: null,
  startAddress: null,
  endAddress: null,
  distanceKm: null,
  maxSpeedKph: null,
  fuelUsedL: null,
  drivingScore: null,
  inProgress: true,
  drivingEvents: [],
};
// Explicit read snapshots cover real routing and transport without a fixture query engine.
// Backend/browser checks prove filtering, summary calculations and telemetry classification.
graphqlFixture(AdminTripsDocument, (variables) => ({
  fleetTrips: {
    __typename: 'FleetTripPage',
    items: [fixtureTrip],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
    totalDistanceKm: 150,
  },
}));
graphqlFixture(AdminTripDocument, (variables) => {
  const trip = [fixtureTrip, fixtureOpenTrip].find(
    (trip) => trip.id === variables.requiredString('id'),
  );
  if (!trip) {
    throw fixtureError('NOT_FOUND', 'The trip was not found.');
  }
  return { fleetTrip: trip };
});
graphqlFixture(AdminTripSummaryDocument, () => ({
  fleetTripSummary: {
    __typename: 'FleetTripSummary',
    totalTrips: 2,
    distanceKm: 150,
    totalDurationSeconds: 3600,
    averageDrivingScore: 80,
    totalManeuverEvents: 2,
  },
}));
graphqlFixture(AdminTripVehiclesDocument, (variables) => ({
  fleetVehicles: {
    __typename: 'FleetVehiclePage',
    items: [
      {
        __typename: 'FleetVehicle',
        id: fixtureTrip.vehicleId,
        licensePlate: fixtureTrip.vehicle.licensePlate,
      },
    ],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 100),
  },
}));
graphqlFixture(AdminTripDriversDocument, (variables) => ({
  fleetDrivers: {
    __typename: 'FleetDriverPage',
    items: [{ __typename: 'FleetDriver', id: driverId, firstName: 'Elena', lastName: 'Petrova' }],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 100),
  },
}));
