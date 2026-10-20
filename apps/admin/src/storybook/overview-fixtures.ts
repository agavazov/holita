import {
  AdminFleetOverviewDocument,
  type AdminFleetOverviewQuery,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';

const overview: WithTypename<AdminFleetOverviewQuery> = {
  fleetOverview: {
    __typename: 'FleetOverview',
    dataAsOf: '2026-10-18T07:00:00Z',
    businessDate: '2026-10-18',
    activeVehicles: 12,
    movingVehicles: 4,
    notReportingVehicles: 2,
    distanceTodayKm: 140,
    openCriticalAlerts: 1,
    overdueService: 1,
    dailyDistance: Array.from({ length: 14 }, (_, index) => ({
      __typename: 'FleetDailyDistancePoint',
      date: `2026-10-${String(index + 5).padStart(2, '0')}`,
      distanceKm: index === 13 ? 140 : 100 + index * 30,
    })),
    activityByGroup: [
      {
        __typename: 'FleetGroupActivity',
        group: {
          __typename: 'FleetVehicleGroupRef',
          id: '30000000-0000-4000-8000-000000000001',
          name: 'International',
          colorToken: 'C2',
        },
        total: 5,
        moving: 2,
        idle: 1,
        parked: 1,
        notReporting: 1,
        asset: 0,
        noDevice: 0,
      },
      {
        __typename: 'FleetGroupActivity',
        group: null,
        total: 3,
        moving: 2,
        idle: 0,
        parked: 0,
        notReporting: 1,
        asset: 0,
        noDevice: 0,
      },
    ],
  },
  critical: {
    __typename: 'FleetEventPage',
    items: [
      {
        __typename: 'FleetEvent',
        id: '60000000-0000-4000-8000-000000000002',
        kind: 'POWER_DISCONNECTED',
        details: 'The external power supply was disconnected.',
        vehicle: { __typename: 'FleetVehicleRef', licensePlate: 'CB 1001 AX' },
      },
    ],
  },
  overdue: { __typename: 'FleetServiceTaskPage', items: [] },
  documents: { __typename: 'FleetDriverPage', items: [] },
  fleetDeviceSummary: { __typename: 'FleetDeviceSummary', offline: 2 },
  fleetTrips: {
    __typename: 'FleetTripPage',
    items: [
      {
        __typename: 'FleetTrip',
        id: '70000000-0000-4000-8000-000000000001',
        vehicleId: '50000000-0000-4000-8000-000000000001',
        vehicle: { __typename: 'FleetVehicleRef', licensePlate: 'CB 1001 AX' },
        startedAt: '2026-10-18T06:00:00Z',
        startAddress: 'Sofia',
        endAddress: 'Plovdiv',
        distanceKm: 140,
      },
    ],
  },
};
graphqlFixture(AdminFleetOverviewDocument, () => overview);
