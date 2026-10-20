import {
  AdminVehicleProfileDocument,
  AdminVehicleProfileTripsDocument,
  AdminVehicleProfileAlertsDocument,
  AdminVehicleProfileServiceDocument,
  AdminVehicleOdometerDocument,
  AdminRecordOdometerDocument,
  type AdminVehicleProfileFragment,
  type AdminVehicleProfileServiceDetailsFragment,
  type AdminRecordOdometerMutation,
} from '../generated/graphql/operations';
import { fixtureAlert } from './alerts-fixtures';
import { fixtureTrip } from './trips-fixtures';
import { fixtureServiceTask, fixtureServiceReceipt } from './maintenance-fixtures';
import { fixtureVehicle } from './vehicles-fixtures';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';

const at = '2026-10-18T07:00:00.000Z';
export const fixtureProfileService: WithTypename<AdminVehicleProfileServiceDetailsFragment> =
  fixtureServiceTask;
export const fixtureVehicleProfile: WithTypename<AdminVehicleProfileFragment> = {
  ...fixtureVehicle,
  nextService: fixtureProfileService,
  state: { ...fixtureVehicle.state, odometerRecordedAt: '2026-10-18T06:50:00.000Z' },
};
const clock = {
  __typename: 'FleetDataClock',
  asOf: at,
  businessDate: '2026-10-18',
  timeZone: 'Europe/Sofia',
} as const;

// Immutable contract snapshots, including after writes. Browser/backend checks prove persistence.
graphqlFixture(AdminVehicleProfileDocument, (variables) => {
  if (variables.requiredString('id') !== fixtureVehicle.id) {
    throw fixtureError('NOT_FOUND', 'The vehicle was not found.');
  }
  return {
    fleetVehicle: fixtureVehicleProfile,
    fleetDataClock: clock,
    fleetDailyDistance: {
      __typename: 'FleetDailyDistance',
      dataAsOf: at,
      points: [
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-05', distanceKm: 0 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-06', distanceKm: 180 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-07', distanceKm: 310 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-08', distanceKm: 95 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-09', distanceKm: 180 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-10', distanceKm: 0 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-11', distanceKm: 0 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-12', distanceKm: 250 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-13', distanceKm: 140 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-14', distanceKm: 400 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-15', distanceKm: 285 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-16', distanceKm: 190 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-17', distanceKm: 0 },
        { __typename: 'FleetDailyDistancePoint', date: '2026-10-18', distanceKm: 150 },
      ],
    },
  };
});
graphqlFixture(AdminVehicleOdometerDocument, (variables) => {
  if (variables.requiredString('id') !== fixtureVehicle.id) {
    throw fixtureError('NOT_FOUND', 'The vehicle was not found.');
  }
  return { fleetVehicle: fixtureVehicleProfile, fleetDataClock: clock };
});
graphqlFixture(AdminVehicleProfileTripsDocument, (variables) => ({
  fleetTrips: {
    __typename: 'FleetTripPage',
    items: [fixtureTrip],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
    totalDistanceKm: 150,
  },
}));
graphqlFixture(AdminVehicleProfileAlertsDocument, (variables) => ({
  fleetEvents: {
    __typename: 'FleetEventPage',
    items: [fixtureAlert],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
  },
}));
graphqlFixture(AdminVehicleProfileServiceDocument, (variables) => ({
  fleetServiceTasks: {
    __typename: 'FleetServiceTaskPage',
    items: [fixtureProfileService, fixtureServiceReceipt],
    total: 2,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
  },
}));
graphqlFixture(
  AdminRecordOdometerDocument,
  (variables): WithTypename<AdminRecordOdometerMutation> => {
    const input = variables.object('input');
    return {
      recordFleetOdometerReading: {
        __typename: 'FleetStatusSample',
        id: '81000000-0000-4000-8000-000000000001',
        vehicleId: input.requiredString('vehicleId'),
        source: 'MANUAL',
        odometerKm: input.number('odometerKm'),
        recordedAt: input.requiredString('recordedAt'),
      },
    };
  },
);
