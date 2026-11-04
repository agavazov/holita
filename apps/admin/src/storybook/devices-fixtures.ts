import {
  AdminCreateDeviceDocument,
  AdminDeleteDevicesDocument,
  AdminDeviceDocument,
  AdminDevicesDocument,
  AdminDevicesLiveDocument,
  AdminDeviceVehiclesDocument,
  AdminUpdateDeviceDocument,
  type AdminDeviceDetailsFragment,
  type AdminDevicesLiveQuery,
} from '../generated/graphql/operations';
import {
  graphqlFixture,
  fixtureError,
  type WithTypename,
  type FixtureVariables,
} from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';

const vehicle = {
  __typename: 'FleetVehicle',
  id: '50000000-0000-4000-8000-000000000001',
  licensePlate: 'CB 1001 AX',
} as const;
export const fixtureDevice: WithTypename<AdminDeviceDetailsFragment> = {
  __typename: 'FleetDevice',
  id: '60000000-0000-4000-8000-000000000001',
  branchId: defaultBranchId,
  imei: '001234567890123',
  model: 'STARLINK_TRACKER',
  serialNumber: '279037',
  options: ['CELLULAR_4G', 'CAN'],
  firmwareVersion: '2.26.1',
  edataModule: 'eData Fms 6.56',
  simIccid: '8935901990012345678',
  simPhoneNumber: '+359888123456',
  smsPassword: 'password',
  installedAt: '2026-01-01T08:00:00.000Z',
  notes: 'Cab tracker',
  status: 'ONLINE',
  lastReportedAt: '2026-10-20T08:00:00.000Z',
  vehicleId: '50000000-0000-4000-8000-000000000001',
  vehicle: { ...vehicle, __typename: 'FleetVehicleRef' },
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
};

// Fixed read snapshots exercise live containers/transport; persistence and query semantics
// stay in the real backend/browser checks rather than a second backend in story fixtures.
graphqlFixture(AdminDevicesDocument, (variables) => ({
  fleetDevices: {
    __typename: 'FleetDevicePage',
    items: [fixtureDevice],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
  },
}));
export const fixtureLiveDevice: WithTypename<
  AdminDevicesLiveQuery['fleetDevices']['items'][number]
> = {
  __typename: 'FleetDevice',
  id: fixtureDevice.id,
  imei: fixtureDevice.imei,
  vehicleId: fixtureDevice.vehicleId,
  status: 'ONLINE',
  lastReportedAt: fixtureDevice.lastReportedAt,
  diagnostics: { __typename: 'FleetDeviceDiagnosticSummary', count: 0, latest: null },
  routing: 'HOLITA',
  ermState: {
    __typename: 'ErmUnitState',
    online: true,
    mode: 'PRIMARY',
    connectedSince: '2026-10-20T07:00:00.000Z',
    latestEvent: {
      __typename: 'ErmEvent',
      eventTime: '2026-10-20T08:00:00.000Z',
      speedKmh: 72,
      engineOn: true,
      ignitionOn: true,
      nameEn: 'Driving',
      nameBg: 'В движение',
    },
    latestAlarm: {
      __typename: 'ErmEvent',
      eventTime: '2026-10-20T07:30:00.000Z',
      severity: 'WARNING',
      nameEn: 'Driver alarm',
      nameBg: 'Аларма от водача',
    },
    lastFrameAt: '2026-10-20T08:00:00.000Z',
    alarmsLast24h: 2,
    health: { __typename: 'ErmUnitHealth', overdue: false },
  },
};
graphqlFixture(AdminDevicesLiveDocument, () => ({
  fleetDevices: {
    __typename: 'FleetDevicePage',
    items: [fixtureLiveDevice],
  },
}));
graphqlFixture(AdminDeviceDocument, (variables) => {
  if (variables.requiredString('id') !== fixtureDevice.id) {
    throw fixtureError('NOT_FOUND', 'The device was not found.');
  }
  return { fleetDevice: fixtureDevice };
});
graphqlFixture(AdminDeviceVehiclesDocument, (variables) => ({
  fleetVehicles: {
    __typename: 'FleetVehiclePage',
    items: [vehicle],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 100),
  },
}));
function saved(variables: FixtureVariables): WithTypename<AdminDeviceDetailsFragment> {
  const input = variables.object('input');
  return {
    ...fixtureDevice,
    imei: input.string('imei') ?? fixtureDevice.imei,
    notes: input.has('notes') ? input.string('notes') : fixtureDevice.notes,
  };
}
graphqlFixture(AdminCreateDeviceDocument, (variables) => ({ createFleetDevice: saved(variables) }));
graphqlFixture(AdminUpdateDeviceDocument, (variables) => ({ updateFleetDevice: saved(variables) }));
graphqlFixture(AdminDeleteDevicesDocument, (variables) => ({
  deleteFleetDevices: {
    __typename: 'FleetDeviceActionResult',
    succeededIds: (variables.strings('ids') ?? []).filter((id) => id === fixtureDevice.id),
    failures: (variables.strings('ids') ?? [])
      .filter((id) => id !== fixtureDevice.id)
      .map((id) => ({
        __typename: 'FleetDeviceActionFailure',
        id,
        code: 'NOT_FOUND',
        message: 'The device was not found.',
      })),
  },
}));
