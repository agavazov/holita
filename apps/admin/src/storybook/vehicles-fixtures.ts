import {
  AdminCreateVehicleDocument,
  AdminDeactivateVehiclesDocument,
  AdminDeleteVehiclesDocument,
  AdminUpdateVehicleDocument,
  AdminVehicleDocument,
  AdminVehicleDriversDocument,
  AdminVehicleGroupsDocument,
  AdminVehiclesDocument,
  AdminVehicleSummaryDocument,
  type AdminVehicleDetailsFragment,
} from '../generated/graphql/operations';
import {
  fixtureError,
  graphqlFixture,
  type FixtureVariables,
  type WithTypename,
} from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';

const at = '2026-10-18T07:00:00.000Z';
const group = {
  __typename: 'FleetVehicleGroup',
  id: '30000000-0000-4000-8000-000000000001',
  name: 'International',
} as const;
const driver = {
  __typename: 'FleetDriver',
  id: '40000000-0000-4000-8000-000000000001',
  firstName: 'Elena',
  lastName: 'Petrova',
  status: 'ACTIVE',
} as const;

/** One fixed contract response for stories of the real Vehicles containers. */
export const fixtureVehicle: WithTypename<AdminVehicleDetailsFragment> = {
  __typename: 'FleetVehicle',
  id: '50000000-0000-4000-8000-000000000001',
  branchId: defaultBranchId,
  licensePlate: 'CB 1001 AX',
  fleetNumber: 'T-04',
  vehicleType: 'TRACTOR',
  make: 'Volvo',
  model: 'FH 500',
  modelYear: 2024,
  vin: 'YV2RT40A1RB123456',
  fuelType: 'DIESEL',
  fuelTankCapacityL: 600,
  status: 'ACTIVE',
  groupId: group.id,
  group: { ...group, __typename: 'FleetVehicleGroupRef', colorToken: 'C2' },
  currentDriverId: driver.id,
  currentDriver: { ...driver, __typename: 'FleetDriverRef' },
  deviceCount: 1,
  openAlertCount: 2,
  notes: 'International line\nWorkshop contact confirmed.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: at,
  state: {
    __typename: 'FleetVehicleState',
    activity: 'MOVING',
    lastReportedAt: at,
    latitude: 42.6977,
    longitude: 23.3219,
    address: 'Sofia, Bulgaria',
    speedKph: 55,
    headingDeg: 90,
    ignition: true,
    fuelLevelPct: 8,
    fuelStatus: 'LOW',
    externalVoltage: 27.6,
    backupBatteryVoltage: 3.9,
    engineHours: 4000,
    coolantTempC: 82,
    odometerKm: 120500,
    odometerRecordedAt: at,
    odometerSource: 'DEMO',
  },
};

// These answers exercise transport and container states, rather than emulating persistence,
// filtering or telemetry classification. A refetch always returns this immutable read snapshot,
// including after a successful mutation. Real backend/browser checks cover persisted changes.
graphqlFixture(AdminVehiclesDocument, (variables) => ({
  fleetVehicles: {
    __typename: 'FleetVehiclePage',
    items: [fixtureVehicle],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
  },
}));

graphqlFixture(AdminVehicleDocument, (variables) => {
  if (variables.requiredString('id') !== fixtureVehicle.id) {
    throw fixtureError('NOT_FOUND', 'The vehicle was not found.');
  }
  return { fleetVehicle: fixtureVehicle };
});

graphqlFixture(AdminVehicleSummaryDocument, () => ({
  fleetVehicleSummary: {
    __typename: 'FleetVehicleSummary',
    dataAsOf: at,
    inOperation: 1,
    inWorkshop: 0,
    moving: 1,
    notReporting: 0,
    openAlerts: 2,
    lowFuel: 1,
  },
}));

graphqlFixture(AdminVehicleGroupsDocument, (variables) => ({
  fleetVehicleGroups: {
    __typename: 'FleetVehicleGroupPage',
    items: [group],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 100),
  },
}));

graphqlFixture(AdminVehicleDriversDocument, (variables) => ({
  fleetDrivers: {
    __typename: 'FleetDriverPage',
    items: [driver],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 100),
  },
}));

function savedVehicle(variables: FixtureVariables): WithTypename<AdminVehicleDetailsFragment> {
  const input = variables.object('input');
  return {
    ...fixtureVehicle,
    licensePlate: input.string('licensePlate') ?? fixtureVehicle.licensePlate,
    notes: input.has('notes') ? input.string('notes') : fixtureVehicle.notes,
  };
}

graphqlFixture(AdminCreateVehicleDocument, (variables) => ({
  createFleetVehicle: savedVehicle(variables),
}));
graphqlFixture(AdminUpdateVehicleDocument, (variables) => ({
  updateFleetVehicle: savedVehicle(variables),
}));

graphqlFixture(AdminDeleteVehiclesDocument, (variables) => ({
  deleteFleetVehicles: {
    __typename: 'FleetVehicleActionResult',
    succeededIds: [],
    failures: (variables.strings('ids') ?? []).map((id) => ({
      __typename: 'FleetVehicleActionFailure',
      id,
      code: 'CONFLICT',
      message: 'Vehicles with trackers or history cannot be deleted. Deactivate them instead.',
    })),
  },
}));

graphqlFixture(AdminDeactivateVehiclesDocument, (variables) => {
  const ids = variables.strings('ids') ?? [];
  return {
    deactivateFleetVehicles: {
      __typename: 'FleetVehicleActionResult',
      succeededIds: ids.filter((id) => id === fixtureVehicle.id),
      failures: ids
        .filter((id) => id !== fixtureVehicle.id)
        .map((id) => ({
          __typename: 'FleetVehicleActionFailure',
          id,
          code: 'NOT_FOUND',
          message: 'The vehicle was not found.',
        })),
    },
  };
});
