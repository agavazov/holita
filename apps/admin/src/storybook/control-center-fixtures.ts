import {
  AdminControlCenterConfigurationChangesDocument,
  AdminControlCenterCommandRequestsDocument,
  AdminControlCenterCommandRequestDocument,
  type AdminControlCenterCommandRequestsQuery,
  AdminControlCenterCommandsDocument,
  AdminControlCenterSnapshotsDocument,
  AdminControlCenterDeviceDocument,
  AdminControlCenterEventsDocument,
  AdminControlCenterFramesDocument,
  AdminControlCenterDeviceProblemsDocument,
  type AdminControlCenterDeviceQuery,
  type AdminControlCenterDevicesQuery,
  type AdminControlCenterEventsQuery,
  type AdminControlCenterFramesQuery,
  type AdminControlCenterDeviceProblemsQuery,
  type AdminControlCenterSnapshotsQuery,
  AdminControlCenterSmsDevicesDocument,
  AdminControlCenterDevicesDocument,
  type AdminControlCenterSmsDevicesQuery,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';
import { fixtureDevice, fixtureLiveDevice } from './devices-fixtures';
import { fixtureAlert } from './alerts-fixtures';
import {
  commandPendingFixture,
  commandAcknowledgedFixture,
  commandRejectedFixture,
  commandUnknownFixture,
  commandFailedFixture,
} from './erm-command-fixtures';

type SmsDevice = WithTypename<AdminControlCenterSmsDevicesQuery['fleetDevices']['items'][number]>;

const smsDevices: readonly SmsDevice[] = [
  {
    __typename: 'FleetDevice',
    id: '61000000-0000-4000-8000-000000000001',
    imei: '001234567890123',
    simPhoneNumber: '+359888000001',
    smsPassword: 'password',
    vehicle: {
      __typename: 'FleetVehicleRef',
      id: '50000000-0000-4000-8000-000000000001',
      licensePlate: 'CB 1001 AX',
      fleetNumber: '12',
    },
  },
  {
    __typename: 'FleetDevice',
    id: '61000000-0000-4000-8000-000000000002',
    imei: '001234567890124',
    simPhoneNumber: '+359888000002',
    smsPassword: null,
    vehicle: {
      __typename: 'FleetVehicleRef',
      id: '50000000-0000-4000-8000-000000000002',
      licensePlate: 'CB 1002 AX',
      fleetNumber: null,
    },
  },
  {
    __typename: 'FleetDevice',
    id: '61000000-0000-4000-8000-000000000003',
    imei: '001234567890125',
    simPhoneNumber: null,
    smsPassword: null,
    vehicle: null,
  },
];

graphqlFixture(AdminControlCenterSmsDevicesDocument, (variables) => {
  const ids = variables.strings('ids');
  const devices = ids
    ? [
        {
          __typename: 'FleetDevice',
          id: fixtureDevice.id,
          imei: fixtureDevice.imei,
          simPhoneNumber: fixtureDevice.simPhoneNumber,
          smsPassword: fixtureDevice.smsPassword,
          vehicle: fixtureDevice.vehicle ? { ...fixtureDevice.vehicle, fleetNumber: null } : null,
        },
      ]
    : smsDevices;
  return {
    fleetDevices: { __typename: 'FleetDevicePage', total: devices.length, items: [...devices] },
  };
});

const detailEvent = {
  __typename: 'ErmEvent',
  id: '10',
  eventId: '01',
  eventTime: '2026-10-20T08:00:00.000Z',
  positionTime: '2026-10-20T08:00:00.000Z',
  latitude: 42.6977,
  longitude: 23.3219,
  speedKmh: 72,
  heading: 90,
  odometer: 120000,
  engineOn: true,
  ignitionOn: true,
  mainVoltage: 27.4,
  backupVoltage: 3.9,
  category: 'POSITION',
  severity: 'INFO',
  name: 'Driving',
  nameEn: 'Driving',
  nameBg: 'В движение',
} as const;
const detailDevice: WithTypename<AdminControlCenterDeviceQuery['fleetDevice']> = {
  ...fixtureDevice,
  ...fixtureLiveDevice,
  options: [...fixtureDevice.options],
  vehicle: fixtureDevice.vehicle,
  diagnostics: {
    __typename: 'FleetDeviceDiagnosticSummary',
    count: 1,
    latest: {
      __typename: 'FleetDeviceDiagnosticFault',
      kind: 'DIAGNOSTIC_TROUBLE_CODE',
      occurredAt: '2026-10-20T07:30:00.000Z',
      troubleCode: 'SPN 102 FMI 1',
      details: 'Recorded diagnostic report',
      source: 'ERM',
    },
  },
  routingHealth: null,
  ermState: {
    __typename: 'ErmUnitState',
    unitId: fixtureDevice.imei,
    online: true,
    mode: 'PRIMARY',
    connectedSince: '2026-10-20T07:00:00.000Z',
    lastFrameAt: '2026-10-20T08:00:00.000Z',
    alarmsLast24h: 2,
    latestEvent: detailEvent,
    lastPosition: detailEvent,
    latestAlarm: { ...detailEvent, category: 'ALARM', severity: 'WARNING', name: 'Driver alarm' },
    mainVoltage: { __typename: 'ErmReading', value: 27.4, observedAt: detailEvent.eventTime },
    backupVoltage: { __typename: 'ErmReading', value: 3.9, observedAt: detailEvent.eventTime },
    signalQuality: { __typename: 'ErmReading', value: 24, observedAt: detailEvent.eventTime },
    firmwareVersion: {
      __typename: 'ErmTextReading',
      value: '2.26.1',
      observedAt: detailEvent.eventTime,
    },
    edataMeasurements: [
      {
        __typename: 'ErmEdataMeasurement',
        parameterId: 1,
        name: 'Engine Speed (RPM)',
        unit: 'RPM',
        parameterType: 0,
        valueSize: 2,
        valueHex: '09C4',
        observedAt: detailEvent.eventTime,
      },
      {
        __typename: 'ErmEdataMeasurement',
        parameterId: 65000,
        name: null,
        unit: null,
        parameterType: 0,
        valueSize: 1,
        valueHex: '00',
        observedAt: '2026-10-20T07:55:00.000Z',
      },
    ],
    recovery: null,
    health: {
      __typename: 'ErmUnitHealth',
      gapsLast24h: [],
      networkChangesLast24h: 0,
      latestNetworkChange: null,
      lastFrameAgeSeconds: 5,
      expectedIntervalSeconds: 300,
      overdue: false,
      upstreamClosesLast24h: 0,
      karmaRoutingWritesLast24h: 0,
      lastCloseReason: 'device closed',
      lastClosedAt: '2026-10-20T06:59:00.000Z',
      latestKarmaRoutingWrite: null,
    },
  },
};
export const reportingDeviceId = '60000000-0000-4000-8000-000000000002';
const reportingDevice: typeof detailDevice = {
  ...detailDevice,
  id: reportingDeviceId,
  ermState: detailDevice.ermState
    ? {
        ...detailDevice.ermState,
        online: false,
        connectedSince: null,
        health: {
          ...detailDevice.ermState.health,
          lastCloseReason: 'read ETIMEDOUT',
          lastClosedAt: '2026-10-20T08:00:01.000Z',
        },
      }
    : null,
};
graphqlFixture(AdminControlCenterDeviceDocument, (variables) => ({
  fleetDevice: variables.string('id') === reportingDeviceId ? reportingDevice : detailDevice,
}));
const detailEvents: WithTypename<AdminControlCenterEventsQuery['fleetDevice']['ermEvents']> = {
  __typename: 'ErmEventsPage',
  cursor: null,
  nextCursor: null,
  hasMore: false,
  items: [
    { ...detailEvent, fields: ['1', '72'], edata: null },
    {
      ...detailEvent,
      id: '11',
      category: 'EDATA',
      name: 'External device',
      fields: ['33'],
      edata: { type: 419, faults: [{ spn: 102, fmi: 1, status: 2 }] },
    },
  ],
};
graphqlFixture(AdminControlCenterEventsDocument, (variables) => {
  const categories = variables.object('input').strings('categories');
  return {
    fleetDevice: {
      __typename: 'FleetDevice',
      id: fixtureDevice.id,
      ermEvents: {
        ...detailEvents,
        items: detailEvents.items.filter(
          (event) => !categories || categories.includes(event.category),
        ),
      },
    },
  };
});

type DashboardDevice = WithTypename<
  AdminControlCenterDevicesQuery['fleetDevices']['items'][number]
>;
const normalDashboardDevice = {
  ...detailDevice,
  id: 'dashboard-reporting-device',
  imei: '001234567890126',
  vehicleId: 'dashboard-reporting-truck',
  vehicle: {
    __typename: 'FleetVehicleRef',
    id: 'dashboard-reporting-truck',
    licensePlate: 'CB 1002 AX',
  },
  diagnostics: { __typename: 'FleetDeviceDiagnosticSummary', count: 0, latest: null },
  ermState: {
    __typename: 'ErmUnitState',
    online: false,
    mode: 'PRIMARY',
    connectedSince: null,
    lastFrameAt: detailEvent.eventTime,
    alarmsLast24h: 265,
    lastPosition: detailEvent,
    latestEvent: detailEvent,
    latestAlarm: {
      eventTime: detailEvent.eventTime,
      severity: 'WARNING',
      nameEn: 'Diagnostic report',
      nameBg: 'Диагностичен отчет',
    },
    health: {
      overdue: false,
      karmaRoutingWritesLast24h: 0,
      lastFrameAgeSeconds: 5,
      expectedIntervalSeconds: 300,
      lastCloseReason: 'device closed',
    },
  },
} satisfies DashboardDevice;
const overdueDashboardDevice = {
  ...normalDashboardDevice,
  id: 'dashboard-overdue-device',
  imei: '001234567890127',
  vehicleId: 'dashboard-overdue-truck',
  vehicle: {
    __typename: 'FleetVehicleRef',
    id: 'dashboard-overdue-truck',
    licensePlate: 'CB 1003 AX',
  },
  routing: 'KARMA_BACKUP',
  ermState: {
    ...normalDashboardDevice.ermState,
    health: {
      overdue: true,
      karmaRoutingWritesLast24h: 0,
      lastFrameAgeSeconds: 8100,
      expectedIntervalSeconds: 300,
      lastCloseReason: 'device closed',
    },
  },
} satisfies DashboardDevice;
const neverDashboardDevice = {
  ...normalDashboardDevice,
  id: 'dashboard-never-device',
  imei: '001234567890128',
  vehicleId: 'dashboard-never-truck',
  vehicle: {
    __typename: 'FleetVehicleRef',
    id: 'dashboard-never-truck',
    licensePlate: 'CB 1004 AX',
  },
  lastReportedAt: null,
  ermState: {
    ...normalDashboardDevice.ermState,
    lastFrameAt: null,
    alarmsLast24h: 0,
    lastPosition: null,
    latestEvent: null,
    latestAlarm: null,
  },
} satisfies DashboardDevice;
const dashboardDevices = [
  detailDevice,
  normalDashboardDevice,
  overdueDashboardDevice,
  neverDashboardDevice,
];
graphqlFixture(AdminControlCenterDevicesDocument, () => ({
  fleetDevices: {
    __typename: 'FleetDevicePage',
    total: dashboardDevices.length,
    items: dashboardDevices,
  },
  fleetVehicles: {
    __typename: 'FleetVehiclePage',
    total: dashboardDevices.length + 1,
    items: [
      ...dashboardDevices.map((device) => ({
        __typename: 'FleetVehicle',
        id: device.vehicleId ?? '',
        licensePlate: device.vehicle?.licensePlate ?? '',
        devices: [device],
      })),
      {
        __typename: 'FleetVehicle',
        id: 'uninstalled-truck',
        licensePlate: 'CB 1005 AX',
        devices: [],
      },
    ],
  },
}));

graphqlFixture(AdminControlCenterConfigurationChangesDocument, () => ({
  fleetDevice: {
    __typename: 'FleetDevice',
    id: fixtureDevice.id,
    ermConfigurationWritesEnabled: false,
    ermConfigurationChanges: [],
  },
}));

const commandRequests = [
  commandPendingFixture,
  commandAcknowledgedFixture,
  commandRejectedFixture,
  commandUnknownFixture,
  commandFailedFixture,
];

graphqlFixture(
  AdminControlCenterCommandRequestsDocument,
  (): WithTypename<AdminControlCenterCommandRequestsQuery> => ({
    fleetDevice: {
      __typename: 'FleetDevice',
      id: fixtureDevice.id,
      ermCommandRequests: commandRequests,
    },
  }),
);

graphqlFixture(AdminControlCenterCommandRequestDocument, (variables) => ({
  ermCommandRequest:
    commandRequests.find((request) => request.id === variables.requiredString('id')) ?? null,
}));

graphqlFixture(
  AdminControlCenterFramesDocument,
  (): WithTypename<AdminControlCenterFramesQuery> => {
    const acknowledged = commandAcknowledgedFixture;
    const acknowledgement = acknowledged.transportCommand?.acknowledgement;
    return {
      fleetDevice: {
        __typename: 'FleetDevice',
        id: fixtureDevice.id,
        ermFrames: {
          __typename: 'ErmFramesPage',
          cursor: null,
          nextCursor: null,
          hasMore: false,
          items: [
            {
              __typename: 'ErmFrame',
              id: 'command-confirmation-frame',
              acknowledgement: acknowledgement
                ? { ...acknowledgement, commandRequestId: acknowledged.id }
                : null,
              direction: 'DEVICE',
              receivedAt: acknowledgement?.receivedAt ?? '2026-10-20T07:45:12.000Z',
              command: '02',
              reference: acknowledgement?.replyReference ?? '8063',
              checksum: 'OK',
              partial: false,
              displayText: acknowledged.responseText ?? '',
              rawHex: acknowledged.receivedFrameHex ?? '',
            },
            ...(acknowledged.sentFrame
              ? [{ ...acknowledged.sentFrame, acknowledgement: null, __typename: 'ErmFrame' }]
              : []),
          ] satisfies WithTypename<
            AdminControlCenterFramesQuery['fleetDevice']['ermFrames']['items']
          >,
        },
      },
    };
  },
);

graphqlFixture(AdminControlCenterDeviceProblemsDocument, (variables) => ({
  fleetProblems: {
    __typename: 'FleetProblemPage',
    total: 3,
    offset: variables.int('offset', 0),
    limit: 20,
    counts: {
      __typename: 'FleetProblemCounts',
      asOf: '2026-10-20T08:00:05.000Z',
      dataAsOf: detailEvent.eventTime,
      ermAsOf: '2026-10-20T08:00:05.000Z',
      periodFrom: '2026-10-19T08:00:05.000Z',
      periodTo: '2026-10-20T08:00:05.000Z',
      total: 3,
      requiringAttention: 2,
      recorded: 1,
    },
    items: [
      {
        __typename: 'FleetProblem',
        id: `FLEET_ALERT:${fixtureAlert.id}`,
        sourceKind: 'FLEET_ALERT',
        sourceId: fixtureAlert.id,
        severity: fixtureAlert.severity,
        occurredAt: fixtureAlert.occurredAt,
        state: 'OPEN',
        requiringAttention: true,
        code: fixtureAlert.kind,
        details: fixtureAlert.details,
        deviceId: fixtureDevice.id,
        deviceImei: fixtureDevice.imei,
        vehicleId: fixtureDevice.vehicleId,
        alertId: fixtureAlert.id,
        ermEventId: null,
        commandRequestId: null,
      },
      {
        __typename: 'FleetProblem',
        id: 'DIAGNOSTIC:11',
        sourceKind: 'DIAGNOSTIC',
        sourceId: '11',
        severity: 'WARNING',
        occurredAt: '2026-10-20T07:30:00.000Z',
        state: 'RECORDED',
        requiringAttention: false,
        code: 'SPN 102 FMI 1',
        details: 'Diagnostic report recorded by the device.',
        deviceId: fixtureDevice.id,
        deviceImei: fixtureDevice.imei,
        vehicleId: fixtureDevice.vehicleId,
        alertId: null,
        ermEventId: '11',
        commandRequestId: null,
      },
      {
        __typename: 'FleetProblem',
        id: `COMMAND:${commandUnknownFixture.id}`,
        sourceKind: 'COMMAND',
        sourceId: commandUnknownFixture.id,
        severity: 'WARNING',
        occurredAt: commandUnknownFixture.completedAt ?? commandUnknownFixture.requestedAt,
        state: 'UNCERTAIN',
        requiringAttention: true,
        code: commandUnknownFixture.reasonCode ?? 'REPLY_TIMEOUT',
        details: null,
        deviceId: fixtureDevice.id,
        deviceImei: fixtureDevice.imei,
        vehicleId: fixtureDevice.vehicleId,
        alertId: null,
        ermEventId: null,
        commandRequestId: commandUnknownFixture.id,
      },
    ] satisfies WithTypename<AdminControlCenterDeviceProblemsQuery['fleetProblems']['items']>,
  },
}));

graphqlFixture(AdminControlCenterCommandsDocument, () => ({
  fleetDevice: {
    __typename: 'FleetDevice',
    id: fixtureDevice.id,
    ermCommands: {
      __typename: 'ErmCommandsPage',
      cursor: null,
      nextCursor: null,
      hasMore: false,
      items: commandAcknowledgedFixture.transportCommand
        ? [commandAcknowledgedFixture.transportCommand]
        : [],
    },
  },
}));
graphqlFixture(AdminControlCenterSnapshotsDocument, () => ({
  fleetDevice: {
    __typename: 'FleetDevice',
    id: fixtureDevice.id,
    ermParameterSnapshots: {
      __typename: 'ErmParameterSnapshotsPage',
      cursor: null,
      nextCursor: null,
      hasMore: false,
      items: [
        {
          __typename: 'ErmParameterSnapshot',
          id: 'parameter-snapshot-current',
          unitId: fixtureDevice.imei,
          actorId: 'demo-tenant:sample-tenant',
          intent: 'Read supported device settings',
          status: 'COMPLETE',
          startedAt: '2026-10-20T07:00:00.000Z',
          finishedAt: '2026-10-20T07:00:15.000Z',
          parameterCount: 1,
          readCount: 1,
          failureReason: null,
          values: [
            {
              __typename: 'ErmParameterValue',
              parameter: 593,
              title: 'Simple SMS password',
              value: 'password',
              resultCode: null,
            },
          ],
          changes: [
            {
              __typename: 'ErmParameterChange',
              parameter: 593,
              title: 'Simple SMS password',
              previousValue: 'previouspassword',
              value: 'password',
            },
          ],
        },
        {
          __typename: 'ErmParameterSnapshot',
          id: 'parameter-snapshot-previous',
          unitId: fixtureDevice.imei,
          actorId: 'demo-tenant:sample-tenant',
          intent: 'Read supported device settings',
          status: 'COMPLETE',
          startedAt: '2026-10-19T07:00:00.000Z',
          finishedAt: '2026-10-19T07:00:15.000Z',
          parameterCount: 1,
          readCount: 1,
          failureReason: null,
          values: [
            {
              __typename: 'ErmParameterValue',
              parameter: 593,
              title: 'Simple SMS password',
              value: 'previouspassword',
              resultCode: null,
            },
          ],
          changes: [],
        },
      ] satisfies WithTypename<
        AdminControlCenterSnapshotsQuery['fleetDevice']['ermParameterSnapshots']['items']
      >,
    },
  },
}));
