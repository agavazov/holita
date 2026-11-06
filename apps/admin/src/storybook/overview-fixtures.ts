import {
  AdminFleetOverviewDocument,
  AdminOverviewConnectedDevicesDocument,
  AdminOverviewMapDocument,
  type AdminFleetOverviewQuery,
  type AdminOverviewMapQuery,
} from '../generated/graphql/operations';
import { dashboardAsOf, dashboardProblems } from './dashboard-problems-fixtures';
import { fixtureDevice } from './devices-fixtures';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';

type MapVehicle = WithTypename<AdminOverviewMapQuery['fleetMap']['items'][number]>;
type Overview = WithTypename<AdminFleetOverviewQuery>;

const dailyDistance: Overview['fleetDailyDistance']['points'] = [
  { date: '2026-10-05', distanceKm: 620 },
  { date: '2026-10-06', distanceKm: 810 },
  { date: '2026-10-07', distanceKm: 740 },
  { date: '2026-10-08', distanceKm: 940 },
  { date: '2026-10-09', distanceKm: 680 },
  { date: '2026-10-10', distanceKm: 420 },
  { date: '2026-10-11', distanceKm: 0 },
  { date: '2026-10-12', distanceKm: 870 },
  { date: '2026-10-13', distanceKm: 1090 },
  { date: '2026-10-14', distanceKm: 960 },
  { date: '2026-10-15', distanceKm: 1210 },
  { date: '2026-10-16', distanceKm: 1030 },
  { date: '2026-10-17', distanceKm: 760 },
  { date: '2026-10-18', distanceKm: 290 },
];

const locations = [
  { latitude: 42.6977, longitude: 23.3219 },
  { latitude: 42.1354, longitude: 24.7453 },
  { latitude: 43.2141, longitude: 27.9147 },
  { latitude: 42.5048, longitude: 27.4626 },
  { latitude: 43.417, longitude: 24.6067 },
  { latitude: 43.8356, longitude: 25.9657 },
  { latitude: 42.4258, longitude: 25.6345 },
  { latitude: 42.0129, longitude: 23.0943 },
  { latitude: 43.0757, longitude: 25.6172 },
  { latitude: 41.9344, longitude: 25.5554 },
  { latitude: 42.283, longitude: 22.6911 },
  { latitude: 43.2102, longitude: 23.5529 },
];

function mapVehicles(count: number, noPositions: boolean): readonly MapVehicle[] {
  return Array.from({ length: count }, (_, index) => {
    const status = index % 8;
    const location = locations[index % locations.length];
    const ageSeconds = status === 4 || status === 6 ? 93600 : 60 + index * 10;
    return {
      __typename: 'FleetMapVehicle',
      vehicle: {
        __typename: 'FleetVehicleRef',
        id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        licensePlate: `CB ${String(1001 + index)} AX`,
      },
      position:
        noPositions || status === 7 || !location
          ? null
          : {
              __typename: 'FleetMapPosition',
              latitude: location.latitude + Math.floor(index / locations.length) * 0.03,
              longitude: location.longitude + Math.floor(index / locations.length) * 0.025,
              headingDeg: (index * 35) % 360,
              recordedAt: new Date(Date.parse(dashboardAsOf) - ageSeconds * 1000).toISOString(),
              ageSeconds,
            },
      activity: status < 3 ? 'MOVING' : status === 7 ? 'NO_DEVICE' : 'PARKED',
      connected: status <= 4,
      reporting: status < 4 || status === 5,
      live: status < 4,
      devices:
        status === 7
          ? []
          : [
              {
                __typename: 'FleetMapDeviceStatus',
                deviceId: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
                expectedIntervalSeconds: 300,
              },
            ],
    };
  });
}

/** Immutable snapshots; many trucks deliberately requires two map pages. */
export function overviewFixtures(
  options: { readonly manyTrucks?: boolean; readonly noPositions?: boolean } = {},
): () => void {
  const noPositions = options.noPositions ?? false;
  const vehicles = mapVehicles(options.manyTrucks ? 137 : 12, noPositions);
  const connected = vehicles.filter((vehicle) => vehicle.connected).length;
  const reporting = vehicles.filter((vehicle) => vehicle.reporting).length;
  const live = vehicles.filter((vehicle) => vehicle.live).length;
  const devices = vehicles.flatMap((vehicle) => vehicle.devices);
  const dataAsOf = noPositions ? null : dashboardAsOf;
  const withPosition = vehicles.filter((vehicle) => vehicle.position !== null).length;
  graphqlFixture(AdminOverviewMapDocument, (variables) => {
    const offset = variables.int('offset', 0);
    const limit = variables.int('limit', 100);
    return {
      fleetMap: {
        __typename: 'FleetMapPage',
        asOf: dashboardAsOf,
        dataAsOf,
        liveAsOf: dashboardAsOf,
        total: vehicles.length,
        withPosition,
        withoutPosition: vehicles.length - withPosition,
        offset,
        limit,
        hasMore: offset + limit < vehicles.length,
        items: vehicles.slice(offset, offset + limit),
      },
    };
  });
  graphqlFixture(AdminOverviewConnectedDevicesDocument, (variables) => {
    const offset = variables.int('offset', 0);
    const limit = variables.int('limit', 100);
    const rows = vehicles.flatMap((vehicle, index) =>
      vehicle.devices.map((device) => ({
        __typename: 'FleetDevice',
        id: device.deviceId,
        imei: index === 0 ? fixtureDevice.imei : String(862129080254620 + index),
        vehicle: vehicle.vehicle,
        ermState: {
          __typename: 'ErmUnitState',
          online: vehicle.connected,
          lastFrameAt: vehicle.reporting ? '2026-10-18T06:59:00.000Z' : '2026-10-18T05:30:00.000Z',
        },
      })),
    );
    return {
      fleetDevices: {
        __typename: 'FleetDevicePage',
        total: rows.length,
        offset,
        limit,
        items: rows.slice(offset, offset + limit),
      },
    };
  });
  graphqlFixture(AdminFleetOverviewDocument, (variables): Overview => {
    const points = noPositions ? [] : dailyDistance.slice(-variables.int('days', 14));
    return {
      fleetDashboard: {
        __typename: 'FleetDashboard',
        vehicles: {
          __typename: 'FleetDashboardVehicles',
          asOf: dashboardAsOf,
          dataAsOf,
          liveAsOf: dashboardAsOf,
          total: vehicles.length,
          connected,
          reporting,
          live,
        },
        devices: {
          __typename: 'FleetDashboardDevices',
          asOf: dashboardAsOf,
          liveAsOf: dashboardAsOf,
          total: devices.length,
          connected,
          reporting,
          live,
        },
        trips: {
          __typename: 'FleetDashboardTrips',
          asOf: dashboardAsOf,
          dataAsOf,
          from: variables.requiredString('from'),
          to: variables.requiredString('to'),
          total: noPositions ? 0 : points.length * 6,
          distanceKm: points.reduce((total, point) => total + point.distanceKm, 0),
          distanceKnownTrips: noPositions ? 0 : points.length * 6 - 2,
        },
        problems: {
          __typename: 'FleetProblemCounts',
          asOf: dashboardAsOf,
          dataAsOf,
          ermAsOf: dashboardAsOf,
          periodFrom: variables.requiredString('from'),
          periodTo: variables.requiredString('to'),
          total: dashboardProblems.length,
          requiringAttention: 5,
          recorded: 2,
        },
      },
      fleetOverview: {
        __typename: 'FleetOverview',
        dataAsOf,
        businessDate: '2026-10-18',
        overdueService: 2,
      },
      fleetDailyDistance: {
        __typename: 'FleetDailyDistance',
        dataAsOf,
        points,
      },
      critical: {
        __typename: 'FleetProblemPage',
        items: dashboardProblems.filter(
          (item) => item.requiringAttention && item.severity === 'CRITICAL',
        ),
      },
      warning: {
        __typename: 'FleetProblemPage',
        items: dashboardProblems.filter(
          (item) => item.requiringAttention && item.severity === 'WARNING',
        ),
      },
      information: { __typename: 'FleetProblemPage', items: [] },
      overdue: {
        __typename: 'FleetServiceTaskPage',
        total: 2,
        items: [
          {
            __typename: 'FleetServiceTask',
            id: 'a0000000-0000-4000-8000-000000000001',
            title: 'Oil and filter change',
            serviceType: 'OIL_CHANGE',
            dueOn: '2026-10-16',
            vehicle: { __typename: 'FleetVehicleRef', licensePlate: 'CB 1001 AX' },
          },
          {
            __typename: 'FleetServiceTask',
            id: 'a0000000-0000-4000-8000-000000000002',
            title: 'Annual technical inspection',
            serviceType: 'ANNUAL_INSPECTION',
            dueOn: '2026-10-17',
            vehicle: { __typename: 'FleetVehicleRef', licensePlate: 'CB 1003 AX' },
          },
        ],
      },
      documents: {
        __typename: 'FleetDriverPage',
        total: 1,
        items: [
          {
            __typename: 'FleetDriver',
            id: '40000000-0000-4000-8000-000000000001',
            firstName: 'Elena',
            lastName: 'Petrova',
            documentStatus: 'EXPIRED',
          },
        ],
      },
      fleetDriverSummary: { __typename: 'FleetDriverSummary', active: 10, onLeave: 2 },
    };
  });
  return () => {
    overviewFixtures();
  };
}

overviewFixtures();
