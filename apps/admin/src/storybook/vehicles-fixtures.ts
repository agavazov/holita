import {
  AdminCreateVehicleDocument,
  AdminDeactivateVehiclesDocument,
  AdminDeleteVehiclesDocument,
  AdminUpdateVehicleDocument,
  AdminVehicleDocument,
  AdminVehicleDriversDocument,
  AdminVehicleGroupsDocument,
  AdminVehiclesDocument,
  AdminVehiclesLiveDocument,
  AdminVehicleMapDocument,
  AdminVehiclesProblemsDocument,
  type AdminFleetLiveDeviceFragment,
  AdminVehicleSummaryDocument,
  type AdminVehicleDetailsFragment,
  type AdminVehiclesLiveQuery,
  type AdminVehiclesProblemsQuery,
} from '../generated/graphql/operations';
import {
  fixtureError,
  graphqlFixture,
  type FixtureVariables,
  type WithTypename,
} from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';
import { Injectable } from '@angular/core';
import { HttpResponse, type HttpEvent, type HttpRequest } from '@angular/common/http';
import { delay, of, type Observable } from 'rxjs';
import { FixtureHttpBackend } from './graphql-fixtures';

const at = '2026-10-18T07:00:00.000Z';
const fixtureCurrentWarnings = [
  {
    __typename: 'FleetWarningLamp',
    deviceId: '60000000-0000-4000-8000-000000000001',
    parameterId: 1896,
    state: 'RED',
    value: 1,
    valueHex: '01',
    recordedAt: at,
    stateSince: '2026-10-18T06:30:00.000Z',
  },
  {
    __typename: 'FleetWarningLamp',
    deviceId: '60000000-0000-4000-8000-000000000001',
    parameterId: 1906,
    state: 'YELLOW',
    value: 2,
    valueHex: '02',
    recordedAt: at,
    stateSince: '2026-10-18T06:45:00.000Z',
  },
] as const;
const fixtureWarningLamps = [
  ...fixtureCurrentWarnings,
  {
    __typename: 'FleetWarningLamp',
    deviceId: '60000000-0000-4000-8000-000000000001',
    parameterId: 1910,
    state: 'UNKNOWN',
    value: null,
    valueHex: null,
    recordedAt: null,
    stateSince: null,
  },
] as const;
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

/** The same live snapshot is used by the list and the vehicle profile. */
export const fixtureVehicleLiveDevices: readonly [WithTypename<AdminFleetLiveDeviceFragment>] = [
  {
    __typename: 'FleetDevice',
    id: '60000000-0000-4000-8000-000000000001',
    imei: '001234567890123',
    vehicleId: '50000000-0000-4000-8000-000000000001',
    status: 'ONLINE',
    routing: 'HOLITA',
    routingHealth: null,
    lastReportedAt: at,
    diagnostics: { __typename: 'FleetDeviceDiagnosticSummary', count: 2, latest: null },
    currentWarnings: fixtureCurrentWarnings,
    warningLamps: fixtureWarningLamps,
    ermState: {
      __typename: 'ErmUnitState',
      online: true,
      mode: 'PRIMARY',
      connectedSince: at,
      lastFrameAt: at,
      alarmsLast24h: 0,
      latestAlarm: null,
      latestEvent: {
        __typename: 'ErmEvent',
        eventTime: at,
        nameEn: 'Position',
        nameBg: 'Позиция',
        speedKmh: 55,
        engineOn: true,
        ignitionOn: true,
      },
      health: {
        __typename: 'ErmUnitHealth',
        overdue: false,
        lastFrameAgeSeconds: 5,
        expectedIntervalSeconds: 300,
        lastCloseReason: null,
      },
    },
  },
];

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
  devices: fixtureVehicleLiveDevices,
  openAlertCount: 2,
  currentWarnings: fixtureCurrentWarnings,
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

graphqlFixture(AdminVehiclesLiveDocument, (): WithTypename<AdminVehiclesLiveQuery> => ({
  fleetVehicles: {
    __typename: 'FleetVehiclePage',
    items: [
      {
        __typename: 'FleetVehicle',
        id: fixtureVehicle.id,
        currentWarnings: fixtureCurrentWarnings,
        devices: fixtureVehicleLiveDevices,
      },
    ],
  },
}));

/** Delay only asynchronous list context, so the loaded registry stays visible before it arrives. */
@Injectable()
export class DelayedVehiclesLiveBackend extends FixtureHttpBackend {
  override handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const body = request.body;
    const operation =
      typeof body === 'object' && body !== null && 'operationName' in body
        ? body.operationName
        : null;
    const answer = super.handle(request);
    return operation === 'AdminVehiclesLive' ||
      operation === 'AdminVehicleMap' ||
      operation === 'AdminVehiclesProblems'
      ? answer.pipe(delay(2200))
      : answer;
  }
}

@Injectable()
export class EmptyVehiclesBackend extends FixtureHttpBackend {
  override handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const body = request.body;
    if (
      typeof body === 'object' &&
      body !== null &&
      'operationName' in body &&
      body.operationName === 'AdminVehicles'
    ) {
      return of(
        new HttpResponse({
          status: 200,
          body: {
            data: {
              fleetVehicles: {
                __typename: 'FleetVehiclePage',
                items: [],
                total: 0,
                offset: 0,
                limit: 20,
              },
            },
          },
        }),
      );
    }
    return super.handle(request);
  }
}

graphqlFixture(AdminVehicleMapDocument, (variables) => ({
  fleetMap: {
    __typename: 'FleetMapPage',
    asOf: at,
    dataAsOf: at,
    liveAsOf: at,
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 100),
    hasMore: false,
    items: [
      {
        __typename: 'FleetMapVehicle',
        vehicle: {
          __typename: 'FleetVehicleRef',
          id: fixtureVehicle.id,
          licensePlate: fixtureVehicle.licensePlate,
        },
        position: {
          __typename: 'FleetMapPosition',
          latitude: 42.6977,
          longitude: 23.3219,
          headingDeg: 90,
          speedKph: 55,
          recordedAt: at,
          ageSeconds: 5,
        },
        connected: true,
        reporting: true,
        live: true,
      },
    ],
  },
}));

graphqlFixture(
  AdminVehiclesProblemsDocument,
  (variables): WithTypename<AdminVehiclesProblemsQuery> => ({
    fleetProblems: {
      __typename: 'FleetProblemPage',
      offset: variables.int('offset', 0),
      limit: variables.int('limit', 100),
      total: 2,
      items: [
        {
          __typename: 'FleetProblem',
          id: 'alert:storybook-alert',
          diagnostics: [],
          sourceKind: 'FLEET_ALERT',
          sourceId: 'storybook-alert',
          severity: 'WARNING',
          occurredAt: at,
          state: 'OPEN',
          requiringAttention: true,
          code: 'LOW_FUEL',
          details: 'Fuel level below the configured threshold.',
          vehicleId: fixtureVehicle.id,
          deviceId: fixtureVehicleLiveDevices[0].id,
          deviceImei: fixtureVehicleLiveDevices[0].imei,
          alertId: 'storybook-alert',
          fleetEventId: 'storybook-alert',
          ermEventId: null,
          commandRequestId: null,
        },
        {
          __typename: 'FleetProblem',
          id: 'diagnostic:storybook-dtc',
          diagnostics: [],
          sourceKind: 'DIAGNOSTIC',
          sourceId: 'storybook-dtc',
          severity: 'WARNING',
          occurredAt: at,
          state: 'RECORDED',
          requiringAttention: false,
          code: 'P0100',
          details: 'Recorded diagnostic observation; current fault state is unknown.',
          vehicleId: fixtureVehicle.id,
          deviceId: fixtureVehicleLiveDevices[0].id,
          deviceImei: fixtureVehicleLiveDevices[0].imei,
          alertId: null,
          fleetEventId: null,
          ermEventId: 'storybook-dtc',
          commandRequestId: null,
        },
      ],
      counts: {
        __typename: 'FleetProblemCounts',
        asOf: at,
        dataAsOf: at,
        ermAsOf: at,
        periodFrom: '2026-10-17T07:00:00.000Z',
        periodTo: at,
        total: 2,
        requiringAttention: 1,
        recorded: 1,
        bySeverity: [
          {
            __typename: 'FleetProblemSeverityCount',
            severity: 'WARNING',
            total: 2,
            requiringAttention: 1,
            recorded: 1,
          },
        ],
      },
    },
  }),
);
