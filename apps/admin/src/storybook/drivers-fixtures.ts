import {
  AdminCreateDriverDocument,
  AdminDeactivateDriversDocument,
  AdminDeleteDriversDocument,
  AdminDriverDocument,
  AdminDriverContextDocument,
  AdminDriverScorecardDocument,
  AdminDriversDocument,
  AdminDriverSummaryDocument,
  AdminUpdateDriverDocument,
  type AdminDriverDetailsFragment,
  type AdminDriverScorecardQuery,
} from '../generated/graphql/operations';
import {
  graphqlFixture,
  fixtureError,
  type FixtureVariables,
  type WithTypename,
} from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';

const at = '2026-10-18T07:00:00.000Z';
const clock = { __typename: 'FleetDataClock', businessDate: '2026-10-18' } as const;

/** Immutable transport answers for the real Drivers containers; no fake persistence or filters. */
export const fixtureDriver: WithTypename<AdminDriverDetailsFragment> = {
  __typename: 'FleetDriver',
  id: '60000000-0000-4000-8000-000000000001',
  branchId: defaultBranchId,
  firstName: 'Elena',
  lastName: 'Petrova',
  employeeNumber: 'E-004',
  identificationKey: 'KEY-004',
  phone: '+359 888 123 456',
  email: 'elena@example.test',
  licenseNumber: '285001234',
  licenseCategories: ['B', 'C', 'CE'],
  licenseExpiresOn: '2026-11-17',
  tachographCardNumber: 'BG12345678',
  tachographCardExpiresOn: '2028-02-29',
  status: 'ACTIVE',
  notes: 'International line\nContact before the next assignment.',
  vehicles: [
    {
      __typename: 'FleetVehicleRef',
      id: '50000000-0000-4000-8000-000000000001',
      licensePlate: 'CB 1001 AX',
      fleetNumber: 'T-04',
      vehicleType: 'TRACTOR',
      status: 'ACTIVE',
    },
  ],
  documentStatus: 'EXPIRING',
  distance30dKm: 3200.5,
  tripCount30d: 23,
  drivingScore30d: 84.5,
  maneuversPer100Km30d: 0.25,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: at,
};

export const fixtureUnassignedDriver: WithTypename<AdminDriverDetailsFragment> = {
  ...fixtureDriver,
  id: '60000000-0000-4000-8000-000000000002',
  firstName: 'Martin',
  lastName: 'Kolev',
  employeeNumber: null,
  identificationKey: null,
  phone: null,
  email: null,
  licenseNumber: null,
  licenseCategories: [],
  licenseExpiresOn: null,
  tachographCardNumber: null,
  tachographCardExpiresOn: null,
  notes: null,
  vehicles: [],
  documentStatus: 'NOT_RECORDED',
  distance30dKm: 0,
  tripCount30d: 0,
  drivingScore30d: null,
  maneuversPer100Km30d: null,
};

graphqlFixture(AdminDriversDocument, (variables) => ({
  fleetDrivers: {
    __typename: 'FleetDriverPage',
    items: [fixtureDriver, fixtureUnassignedDriver],
    total: 2,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
  },
}));

graphqlFixture(AdminDriverDocument, (variables) => {
  const id = variables.requiredString('id');
  const driver = [fixtureDriver, fixtureUnassignedDriver].find((driver) => driver.id === id);
  if (!driver) {
    throw fixtureError('NOT_FOUND', 'The driver was not found.');
  }
  return { fleetDriver: driver, fleetDataClock: clock };
});

graphqlFixture(AdminDriverContextDocument, () => ({ fleetDataClock: clock }));
graphqlFixture(AdminDriverSummaryDocument, () => ({
  fleetDataClock: clock,
  fleetDriverSummary: {
    __typename: 'FleetDriverSummary',
    dataAsOf: at,
    active: 2,
    onLeave: 0,
    documentsExpiring: 1,
    averageDrivingScore: 84.5,
    distance30dKm: 3200.5,
  },
}));

graphqlFixture(
  AdminDriverScorecardDocument,
  (variables): WithTypename<AdminDriverScorecardQuery> => {
    const id = variables.requiredString('driverId');
    const driver = [fixtureDriver, fixtureUnassignedDriver].find((driver) => driver.id === id);
    if (!driver) {
      throw fixtureError('NOT_FOUND', 'The driver was not found.');
    }
    const days = variables.int('days', 30);
    const hasTrips = driver.id === fixtureDriver.id;
    return {
      fleetDriverScorecard: {
        __typename: 'FleetDriverScorecard',
        driver: {
          __typename: 'FleetDriver',
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          employeeNumber: driver.employeeNumber,
        },
        asOf: at,
        windowStart: new Date(Date.parse(at) - days * 86_400_000).toISOString(),
        windowEnd: at,
        distanceKm: hasTrips ? 3200.5 : 0,
        tripCount: hasTrips ? 23 : 0,
        scoredTripCount: hasTrips ? 20 : 0,
        averageDrivingScore: hasTrips ? 84.5 : null,
        averageEcoScore: hasTrips ? 81 : null,
        maneuverCount: hasTrips ? 8 : 0,
        maneuversPer100Km: hasTrips ? (8 / 3200.5) * 100 : null,
        lowConfidence: !hasTrips,
        maneuvers: [
          {
            __typename: 'FleetManeuverCount',
            kind: 'HARSH_BRAKING',
            intensity1: hasTrips ? 4 : 0,
            intensity2: hasTrips ? 3 : 0,
            intensity3: hasTrips ? 1 : 0,
            intensityUnknown: 0,
            total: hasTrips ? 8 : 0,
          },
        ],
      },
    };
  },
);

function savedDriver(variables: FixtureVariables): WithTypename<AdminDriverDetailsFragment> {
  const input = variables.object('input');
  if (input.string('employeeNumber') === 'TAKEN') {
    throw fixtureError('BAD_USER_INPUT', 'Employee number is already used in this branch.', [
      { path: 'employeeNumber', message: 'Employee number is already used in this branch.' },
    ]);
  }
  return {
    ...fixtureDriver,
    firstName: input.string('firstName') ?? fixtureDriver.firstName,
    lastName: input.string('lastName') ?? fixtureDriver.lastName,
    employeeNumber: input.has('employeeNumber')
      ? input.string('employeeNumber')
      : fixtureDriver.employeeNumber,
    notes: input.has('notes') ? input.string('notes') : fixtureDriver.notes,
  };
}
graphqlFixture(AdminCreateDriverDocument, (variables) => ({
  createFleetDriver: savedDriver(variables),
}));
graphqlFixture(AdminUpdateDriverDocument, (variables) => ({
  updateFleetDriver: savedDriver(variables),
}));

graphqlFixture(AdminDeleteDriversDocument, (variables) => ({
  deleteFleetDrivers: {
    __typename: 'FleetDriverActionResult',
    succeededIds: (variables.strings('ids') ?? []).filter(
      (id) => id === fixtureUnassignedDriver.id,
    ),
    failures: (variables.strings('ids') ?? [])
      .filter((id) => id !== fixtureUnassignedDriver.id)
      .map((id) => ({
        __typename: 'FleetDriverActionFailure',
        id,
        code: 'CONFLICT',
        message: 'Driver is assigned or has trip history; set the driver inactive instead.',
      })),
  },
}));

graphqlFixture(AdminDeactivateDriversDocument, (variables) => ({
  deactivateFleetDrivers: {
    __typename: 'FleetDriverActionResult',
    succeededIds: (variables.strings('ids') ?? []).filter(
      (id) => id === fixtureUnassignedDriver.id,
    ),
    failures: (variables.strings('ids') ?? [])
      .filter((id) => id !== fixtureUnassignedDriver.id)
      .map((id) => ({
        __typename: 'FleetDriverActionFailure',
        id,
        code: 'BAD_USER_INPUT',
        message: 'Unassign the driver from its vehicles first.',
      })),
  },
}));
