import {
  AdminVehicleProfileDocument,
  AdminVehicleProfileTripsDocument,
  AdminVehicleProfileAlertsDocument,
  AdminVehicleDeviceEventsDocument,
  AdminVehicleEdataMeasurementsDocument,
  AdminVehicleProfileServiceDocument,
  AdminVehicleProfileProblemsDocument,
  AdminVehicleTrackDocument,
  AdminVehicleOdometerDocument,
  AdminRecordOdometerDocument,
  type AdminFaultCheckFragment,
  type AdminFaultReadFragment,
  type AdminFreezeFrameFragment,
  type AdminVehicleProfileFragment,
  type AdminVehicleProfileServiceDetailsFragment,
  type AdminRecordOdometerMutation,
  type AdminVehicleDeviceEventsQuery,
  type AdminVehicleProblemDetailsFragment,
  type AdminVehicleProfileProblemsQuery,
  type AdminVehicleTrackQuery,
} from '../generated/graphql/operations';
import { fixtureAlert } from './alerts-fixtures';
import { fixtureTrip } from './trips-fixtures';
import { fixtureServiceTask, fixtureServiceReceipt } from './maintenance-fixtures';
import { fixtureVehicle, fixtureVehicleLiveDevices } from './vehicles-fixtures';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';

const at = '2026-10-18T07:00:00.000Z';
export const fixtureProfileService: WithTypename<AdminVehicleProfileServiceDetailsFragment> =
  fixtureServiceTask;
const finding = {
  __typename: 'FleetFaultFinding',
  code: null,
  spn: null,
  fmi: null,
  descriptionKey: null,
  parameterId: null,
  lampState: null,
  value: null,
  occurrences: 1,
} as const;
export const fixtureFaultCheck: WithTypename<AdminFaultCheckFragment> = {
  __typename: 'FleetFaultCheck',
  checkedAt: '2026-10-18T06:45:00.000Z',
  dataAsOf: '2026-10-18T06:44:00.000Z',
  findings: [
    {
      ...finding,
      system: 'AFTERTREATMENT',
      severity: 'WARNING',
      source: 'FAULT_LOGGER',
      code: 'SPN 3251 FMI 16',
      spn: 3251,
      fmi: 16,
      descriptionKey: 'faults.spn.dpfPressureDifference',
      since: '2026-10-18T05:34:00.000Z',
      lastSeenAt: '2026-10-18T05:34:00.000Z',
    },
    {
      ...finding,
      system: 'CAN_BUS',
      severity: 'WARNING',
      source: 'CAN_REPORT',
      code: 'CAN_DISCONNECTED',
      since: '2026-10-17T07:10:00.000Z',
      lastSeenAt: '2026-10-18T06:40:00.000Z',
      occurrences: 12,
    },
  ],
};
const fixtureFaultRead: WithTypename<AdminFaultReadFragment> = {
  __typename: 'ErmCommandRequest',
  id: '0d7f3c2e-4b1a-4c8e-9f20-6a5b4c3d2e10',
  action: 'READ_EDATA_FAULTS',
  status: 'ANSWERED',
  actorId: 'system:fault-scan',
  createdAt: '2026-10-18T06:00:00.000Z',
  sentAt: '2026-10-18T06:00:03.000Z',
  answeredAt: '2026-10-18T06:00:04.000Z',
  completedAt: '2026-10-18T06:00:04.000Z',
  expiresAt: '2026-10-18T11:50:00.000Z',
  waitingReason: null,
  faultReadVerdict: {
    __typename: 'ErmFaultReadVerdict',
    activeCodes: true,
    codeCount: 1,
    receivedAt: '2026-10-18T06:00:07.000Z',
  },
};
// Values the eData module captured with the SPN 3251 report (eData 415).
const freezeValue = { __typename: 'FleetFreezeFrameValue' } as const;
const fixtureFreezeFrame: WithTypename<AdminFreezeFrameFragment> = {
  __typename: 'FleetFreezeFrame',
  recordedAt: '2026-10-18T05:34:04.000Z',
  values: [
    {
      ...freezeValue,
      parameterId: 1,
      name: 'Engine Speed (RPM)',
      unit: 'RPM',
      valueHex: '05DC',
      value: 1500,
    },
    {
      ...freezeValue,
      parameterId: 539,
      name: 'Engine Coolant Temperature (c)',
      unit: 'c',
      valueHex: '5A',
      value: 90,
    },
    {
      ...freezeValue,
      parameterId: 785,
      name: 'Fuel Level (%)',
      unit: '%',
      valueHex: '2D',
      value: 45,
    },
    { ...freezeValue, parameterId: 2236, name: null, unit: null, valueHex: '00', value: null },
  ],
};
export const fixtureVehicleProfile: WithTypename<AdminVehicleProfileFragment> = {
  ...fixtureVehicle,
  devices: fixtureVehicleLiveDevices.map((device) => ({
    ...device,
    ermCommandRequests: [fixtureFaultRead],
  })),
  warningLamps: fixtureVehicleLiveDevices[0].warningLamps,
  faultCheck: fixtureFaultCheck,
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
    recordedFaultReports: { __typename: 'FleetEventPage', total: 1 },
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
    fleetVehicleFreezeFrame: fixtureFreezeFrame,
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
const fixtureDeviceEvents: readonly WithTypename<
  AdminVehicleDeviceEventsQuery['fleetEvents']['items'][number]
>[] = [
  {
    __typename: 'FleetEvent',
    id: '70000000-0000-4000-8000-000000000101',
    occurredAt: '2026-10-18T06:30:00.000Z',
    kind: 'DIAGNOSTIC_TROUBLE_CODE',
    severity: 'WARNING',
    troubleCode: 'SPN 4339 FMI 7',
    source: 'ERM',
  },
  {
    __typename: 'FleetEvent',
    id: '70000000-0000-4000-8000-000000000102',
    occurredAt: '2026-10-18T05:30:00.000Z',
    kind: 'DIAGNOSTIC_TROUBLE_CODE',
    severity: 'INFO',
    troubleCode: 'SPN 4339 FMI 7',
    source: 'ERM',
  },
];
graphqlFixture(AdminVehicleDeviceEventsDocument, () => ({
  fleetEvents: {
    __typename: 'FleetEventPage',
    total: fixtureDeviceEvents.length,
    items: [...fixtureDeviceEvents],
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
const fixtureVehicleProblems: readonly WithTypename<AdminVehicleProblemDetailsFragment>[] = [
  {
    __typename: 'FleetProblem',
    id: 'COMMAND:90000000-0000-4000-8000-000000000001',
    diagnostics: [],
    sourceKind: 'COMMAND',
    sourceId: '90000000-0000-4000-8000-000000000001',
    severity: 'CRITICAL',
    occurredAt: '2026-10-18T06:45:00.000Z',
    state: 'UNCERTAIN',
    requiringAttention: true,
    code: 'READ_PARAMETERS',
    details: 'The request was sent but no device confirmation was recorded.',
    vehicleId: fixtureVehicle.id,
    deviceId: '60000000-0000-4000-8000-000000000001',
    deviceImei: '001234567890123',
    alertId: null,
    fleetEventId: null,
    ermEventId: null,
    commandRequestId: '90000000-0000-4000-8000-000000000001',
  },
  {
    __typename: 'FleetProblem',
    id: `FLEET_ALERT:fleet:${fixtureAlert.id}`,
    diagnostics: [],
    sourceKind: 'FLEET_ALERT',
    sourceId: `fleet:${fixtureAlert.id}`,
    severity: fixtureAlert.severity,
    occurredAt: fixtureAlert.occurredAt,
    state: 'OPEN',
    requiringAttention: true,
    code: fixtureAlert.kind,
    details: fixtureAlert.details,
    vehicleId: fixtureVehicle.id,
    deviceId: null,
    deviceImei: null,
    alertId: fixtureAlert.id,
    fleetEventId: fixtureAlert.id,
    ermEventId: null,
    commandRequestId: null,
  },
  {
    __typename: 'FleetProblem',
    id: 'DIAGNOSTIC:fleet:70000000-0000-4000-8000-000000000101',
    diagnostics: [
      {
        __typename: 'FleetProblemDiagnostic',
        kind: 'DIAGNOSTIC_TROUBLE_CODE',
        troubleCode: 'SPN 100 FMI 1',
        status: 'ADDED',
        report: 418,
        spn: 100,
        fmi: 1,
        systemKey: 'ENGINE',
        descriptionKey: 'faults.spn.oilPressure',
        catalogVersion: 'discocan-faults-1',
        firstObservedAt: '2026-10-18T06:00:00.000Z',
        lastObservedAt: '2026-10-18T06:15:00.000Z',
        occurredAt: '2026-10-18T06:15:00.000Z',
        receivedAt: '2026-10-18T06:15:05.000Z',
      },
      {
        __typename: 'FleetProblemDiagnostic',
        kind: 'DIAGNOSTIC_TROUBLE_CODE',
        troubleCode: 'SPN 23806 FMI 15',
        status: 'DELETED',
        report: 418,
        spn: 23806,
        fmi: 15,
        systemKey: 'OTHER',
        descriptionKey: null,
        catalogVersion: 'discocan-faults-1',
        firstObservedAt: '2026-10-18T06:10:00.000Z',
        lastObservedAt: '2026-10-18T06:15:00.000Z',
        occurredAt: '2026-10-18T06:15:00.000Z',
        receivedAt: '2026-10-18T06:15:05.000Z',
      },
    ],
    sourceKind: 'DIAGNOSTIC',
    sourceId: 'fleet:70000000-0000-4000-8000-000000000101',
    severity: 'WARNING',
    occurredAt: '2026-10-18T06:15:00.000Z',
    state: 'RECORDED',
    requiringAttention: false,
    code: 'DIAGNOSTIC_TROUBLE_CODE',
    details: null,
    vehicleId: fixtureVehicle.id,
    deviceId: '60000000-0000-4000-8000-000000000001',
    deviceImei: '001234567890123',
    alertId: null,
    fleetEventId: '70000000-0000-4000-8000-000000000101',
    ermEventId: null,
    commandRequestId: null,
  },
  {
    __typename: 'FleetProblem',
    id: 'DIAGNOSTIC:fleet:70000000-0000-4000-8000-000000000103',
    sourceKind: 'DIAGNOSTIC',
    sourceId: 'fleet:70000000-0000-4000-8000-000000000103',
    severity: 'WARNING',
    occurredAt: '2026-10-18T05:45:00.000Z',
    state: 'RECORDED',
    requiringAttention: false,
    code: 'CAN_ERROR',
    details: null,
    vehicleId: fixtureVehicle.id,
    deviceId: '60000000-0000-4000-8000-000000000001',
    deviceImei: '001234567890123',
    alertId: null,
    fleetEventId: '70000000-0000-4000-8000-000000000103',
    ermEventId: null,
    commandRequestId: null,
    diagnostics: [
      {
        __typename: 'FleetProblemDiagnostic',
        kind: 'CAN_ERROR',
        troubleCode: null,
        status: null,
        report: 417,
        spn: null,
        fmi: null,
        systemKey: 'OTHER',
        descriptionKey: null,
        catalogVersion: 'discocan-faults-1',
        firstObservedAt: '2026-10-18T05:30:00.000Z',
        lastObservedAt: '2026-10-18T05:45:00.000Z',
        occurredAt: '2026-10-18T05:45:00.000Z',
        receivedAt: '2026-10-18T05:45:05.000Z',
      },
    ],
  },
];
graphqlFixture(
  AdminVehicleProfileProblemsDocument,
  (variables): WithTypename<AdminVehicleProfileProblemsQuery> => ({
    fleetProblems: {
      __typename: 'FleetProblemPage',
      items: fixtureVehicleProblems,
      total: fixtureVehicleProblems.length,
      offset: variables.int('offset', 0),
      limit: variables.int('limit', 20),
      counts: {
        __typename: 'FleetProblemCounts',
        asOf: at,
        dataAsOf: at,
        ermAsOf: at,
        periodFrom: '2026-10-17T07:00:00.000Z',
        periodTo: at,
        total: 4,
        requiringAttention: 2,
        recorded: 2,
        bySeverity: [
          {
            __typename: 'FleetProblemSeverityCount',
            severity: 'INFO',
            total: 0,
            requiringAttention: 0,
            recorded: 0,
          },
          {
            __typename: 'FleetProblemSeverityCount',
            severity: 'WARNING',
            total: 3,
            requiringAttention: 1,
            recorded: 2,
          },
          {
            __typename: 'FleetProblemSeverityCount',
            severity: 'CRITICAL',
            total: 1,
            requiringAttention: 1,
            recorded: 0,
          },
        ],
      },
    },
  }),
);

graphqlFixture(AdminVehicleTrackDocument, (variables): WithTypename<AdminVehicleTrackQuery> => ({
  fleetVehicleSamples: {
    __typename: 'FleetStatusSampleSeries',
    vehicleId: fixtureVehicle.id,
    from: variables.requiredString('from'),
    to: variables.requiredString('to'),
    truncated: false,
    items: [
      {
        __typename: 'FleetStatusSample',
        id: 'track-1',
        recordedAt: '2026-10-18T06:00:00.000Z',
        latitude: 42.68,
        longitude: 23.28,
      },
      {
        __typename: 'FleetStatusSample',
        id: 'track-2',
        recordedAt: '2026-10-18T06:05:00.000Z',
        latitude: 42.685,
        longitude: 23.29,
      },
      {
        __typename: 'FleetStatusSample',
        id: 'track-3',
        recordedAt: '2026-10-18T06:50:00.000Z',
        latitude: 42.69,
        longitude: 23.31,
      },
      {
        __typename: 'FleetStatusSample',
        id: 'track-4',
        recordedAt: '2026-10-18T06:55:00.000Z',
        latitude: 42.695,
        longitude: 23.315,
      },
      {
        __typename: 'FleetStatusSample',
        id: 'track-5',
        recordedAt: at,
        latitude: fixtureVehicle.state.latitude,
        longitude: fixtureVehicle.state.longitude,
      },
    ],
    track: {
      __typename: 'FleetVehicleTrack',
      asOf: at,
      positionCount: 5,
      firstPositionAt: '2026-10-18T06:00:00.000Z',
      lastPositionAt: at,
      segments: [
        {
          __typename: 'FleetTrackSegment',
          from: '2026-10-18T06:00:00.000Z',
          to: '2026-10-18T06:05:00.000Z',
          sampleIds: ['track-1', 'track-2'],
        },
        {
          __typename: 'FleetTrackSegment',
          from: '2026-10-18T06:50:00.000Z',
          to: at,
          sampleIds: ['track-3', 'track-4', 'track-5'],
        },
      ],
      gaps: [
        {
          __typename: 'FleetTrackGap',
          from: variables.requiredString('from'),
          to: '2026-10-18T06:00:00.000Z',
          reason: 'OUTSIDE_SAMPLES',
          thresholdSeconds: null,
        },
        {
          __typename: 'FleetTrackGap',
          from: '2026-10-18T06:05:00.000Z',
          to: '2026-10-18T06:50:00.000Z',
          reason: 'SAMPLE_GAP',
          thresholdSeconds: 600,
        },
      ],
    },
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

graphqlFixture(AdminVehicleEdataMeasurementsDocument, (variables) => ({
  fleetVehicleEdataMeasurements: {
    __typename: 'FleetVehicleEdataMeasurementSeries',
    from: variables.requiredString('from'),
    to: variables.requiredString('to'),
    truncated: false,
    items: [
      {
        id: 'edata-1',
        recordedAt: '2026-10-18T04:00:00.000Z',
        parameterId: 1,
        valueHex: '0120',
        name: 'Engine Speed',
        unit: 'RPM',
      },
      {
        id: 'edata-2',
        recordedAt: '2026-10-18T06:00:00.000Z',
        parameterId: 1,
        valueHex: '0240',
        name: 'Engine Speed',
        unit: 'RPM',
      },
      {
        id: 'edata-3',
        recordedAt: '2026-10-18T04:00:00.000Z',
        parameterId: 3,
        valueHex: '40',
        name: 'Fuel Level',
        unit: 'L',
      },
      {
        id: 'edata-4',
        recordedAt: '2026-10-18T06:00:00.000Z',
        parameterId: 3,
        valueHex: '3F',
        name: 'Fuel Level',
        unit: 'L',
      },
      {
        id: 'edata-5',
        recordedAt: '2026-10-18T04:00:00.000Z',
        parameterId: 539,
        valueHex: '0050',
        name: 'Engine Coolant Temperature',
        unit: 'c',
      },
      {
        id: 'edata-6',
        recordedAt: '2026-10-18T06:00:00.000Z',
        parameterId: 539,
        valueHex: '0052',
        name: 'Engine Coolant Temperature',
        unit: 'c',
      },
    ].map((item) => ({ __typename: 'FleetVehicleEdataMeasurement', ...item })),
  },
}));
