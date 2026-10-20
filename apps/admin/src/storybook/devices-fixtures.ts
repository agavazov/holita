import {
  AdminCreateDeviceDocument,
  AdminDeleteDevicesDocument,
  AdminDeviceDocument,
  AdminDeviceSummaryDocument,
  AdminDevicesDocument,
  AdminDeviceVehiclesDocument,
  AdminUpdateDeviceDocument,
  type AdminDeviceDetailsFragment,
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
  options: ['CELLULAR_4G', 'CAN'],
  firmwareVersion: '2.26.1',
  simIccid: '8935901990012345678',
  simPhoneNumber: '+359888123456',
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
graphqlFixture(AdminDeviceDocument, (variables) => {
  if (variables.requiredString('id') !== fixtureDevice.id) {
    throw fixtureError('NOT_FOUND', 'The device was not found.');
  }
  return { fleetDevice: fixtureDevice };
});
graphqlFixture(AdminDeviceSummaryDocument, () => ({
  fleetDeviceSummary: {
    __typename: 'FleetDeviceSummary',
    dataAsOf: fixtureDevice.lastReportedAt,
    online: 1,
    offline: 0,
    inStock: 0,
  },
}));
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
