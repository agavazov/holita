import {
  AdminControlCenterQueueDeviceLabelsDocument,
  AdminControlCenterParameterBaselineDocument,
  type AdminControlCenterParameterBaselineQuery,
  AdminControlCenterSettingsDevicesDocument,
  AdminControlCenterConfigurationChangesDocument,
  type AdminControlCenterConfigurationChangesQuery,
  AdminControlCenterCommandRequestsDocument,
  AdminControlCenterCommandRequestDocument,
  type AdminControlCenterCommandRequestsQuery,
  AdminControlCenterCommandsDocument,
  AdminControlCenterSnapshotsDocument,
  AdminControlCenterDeviceDocument,
  AdminControlCenterReturnToHolitaDocument,
  AdminControlCenterEventsDocument,
  AdminControlCenterFramesDocument,
  AdminControlCenterDeviceProblemsDocument,
  type AdminControlCenterDeviceQuery,
  type AdminControlCenterReturnToHolitaMutation,
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
import {
  settingsWritableDeviceId,
  settingsBatchDeviceId,
  settingsBatchRunFixture,
} from './device-settings-fixtures';
import { fixtureDevice, fixtureLiveDevice } from './devices-fixtures';
import { fixtureAlert } from './alerts-fixtures';
import { queueRequests } from './queue-fixtures';
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
    count: 0,
    latest: {
      __typename: 'FleetDeviceDiagnosticFault',
      kind: 'DIAGNOSTIC_TROUBLE_CODE',
      occurredAt: '2026-10-20T07:30:00.000Z',
      troubleCode: 'SPN 102 FMI 1',
      details: 'Recorded diagnostic report',
      source: 'ERM',
    },
  },
  ermRouting: {
    __typename: 'ErmDeviceRouting',
    state: 'HOLITA',
    since: '2026-10-20T07:00:00.000Z',
    observedAt: '2026-10-20T08:00:05.000Z',
    latestKarmaReportAt: null,
    parked: null,
    latestReturnAttempt: null,
  },
  currentWarnings: [],
  warningLamps: [
    {
      __typename: 'FleetWarningLamp',
      deviceId: fixtureDevice.id,
      stateSince: detailEvent.eventTime,
      parameterId: 1896,
      state: 'OFF',
      recordedAt: detailEvent.eventTime,
    },
    {
      __typename: 'FleetWarningLamp',
      deviceId: fixtureDevice.id,
      stateSince: detailEvent.eventTime,
      parameterId: 1906,
      state: 'OFF',
      recordedAt: detailEvent.eventTime,
    },
    {
      __typename: 'FleetWarningLamp',
      deviceId: fixtureDevice.id,
      stateSince: detailEvent.eventTime,
      parameterId: 1910,
      state: 'OFF',
      recordedAt: detailEvent.eventTime,
    },
  ],
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
      networkChangesLast24h: 2,
      latestNetworkChange: {
        __typename: 'ErmNetworkChange',
        at: '2026-10-20T07:50:00.000Z',
        networkType: 'LTE',
        operatorCode: '28401',
      },
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
export const karmaBackupDeviceId = '60000000-0000-4000-8000-000000000003';
export const uncertainReturnDeviceId = '60000000-0000-4000-8000-000000000004';
export const unobservedDeviceId = '60000000-0000-4000-8000-000000000005';
const backupLastFrameAt = '2026-10-20T07:30:00.000Z';
const backupEvent = {
  ...detailEvent,
  eventTime: backupLastFrameAt,
  positionTime: backupLastFrameAt,
};
const earlierRecovery = {
  __typename: 'ErmRecoverySession',
  id: 'recovery-needs-operator',
  startedAt: '2026-10-20T07:40:00.000Z',
  finishedAt: '2026-10-20T07:40:12.000Z',
  outcome: 'NEEDS_OPERATOR',
  reason: 'The primary server configuration requires an operator.',
} as const;
const backupWarningLamps: WithTypename<
  AdminControlCenterDeviceQuery['fleetDevice']['warningLamps']
> = [
  {
    __typename: 'FleetWarningLamp',
    deviceId: karmaBackupDeviceId,
    stateSince: backupLastFrameAt,
    parameterId: 1896,
    state: 'RED',
    recordedAt: backupLastFrameAt,
  },
  {
    __typename: 'FleetWarningLamp',
    deviceId: karmaBackupDeviceId,
    stateSince: backupLastFrameAt,
    parameterId: 1906,
    state: 'YELLOW',
    recordedAt: backupLastFrameAt,
  },
  {
    __typename: 'FleetWarningLamp',
    deviceId: karmaBackupDeviceId,
    parameterId: 1910,
    state: 'UNKNOWN',
    recordedAt: null,
    stateSince: null,
  },
];
const karmaBackupDevice: typeof detailDevice = {
  ...detailDevice,
  id: karmaBackupDeviceId,
  imei: '001234567890125',
  lastReportedAt: backupLastFrameAt,
  routing: 'KARMA_BACKUP',
  ermRouting: {
    __typename: 'ErmDeviceRouting',
    state: 'KARMA_BACKUP',
    since: '2026-10-20T07:35:00.000Z',
    observedAt: '2026-10-20T08:00:05.000Z',
    latestKarmaReportAt: detailEvent.eventTime,
    parked: true,
    latestReturnAttempt: {
      __typename: 'ErmKarmaReturnAttempt',
      id: 'return-needs-operator',
      requestedAt: '2026-10-20T07:38:00.000Z',
      status: 'NEEDS_OPERATOR',
      pending: false,
      holitaConnectedAt: null,
      recovery: earlierRecovery,
    },
  },
  warningLamps: backupWarningLamps,
  currentWarnings: backupWarningLamps.filter(
    (lamp) => lamp.state === 'RED' || lamp.state === 'YELLOW',
  ),
  diagnostics: { ...detailDevice.diagnostics, count: 2 },
  ermState: detailDevice.ermState
    ? {
        ...detailDevice.ermState,
        unitId: '001234567890125',
        online: false,
        connectedSince: null,
        lastFrameAt: backupLastFrameAt,
        latestEvent: backupEvent,
        lastPosition: backupEvent,
        latestAlarm: {
          ...backupEvent,
          category: 'ALARM',
          severity: 'WARNING',
          name: 'Driver alarm',
        },
        mainVoltage: { __typename: 'ErmReading', value: 24.8, observedAt: backupLastFrameAt },
        backupVoltage: { __typename: 'ErmReading', value: 3.8, observedAt: backupLastFrameAt },
        signalQuality: { __typename: 'ErmReading', value: 9, observedAt: backupLastFrameAt },
        firmwareVersion: {
          __typename: 'ErmTextReading',
          value: '2.25.0',
          observedAt: backupLastFrameAt,
        },
        edataMeasurements: [],
        health: {
          ...detailDevice.ermState.health,
          lastFrameAgeSeconds: 1805,
          overdue: true,
          lastClosedAt: backupLastFrameAt,
        },
      }
    : null,
};
const uncertainReturnDevice: typeof detailDevice = {
  ...karmaBackupDevice,
  id: uncertainReturnDeviceId,
  imei: '001234567890126',
  ermRouting: {
    ...karmaBackupDevice.ermRouting,
    latestReturnAttempt: {
      __typename: 'ErmKarmaReturnAttempt',
      id: 'return-uncertain',
      requestedAt: '2026-10-20T07:58:00.000Z',
      status: 'UNCERTAIN',
      pending: true,
      holitaConnectedAt: null,
      recovery: null,
    },
  },
  ermState: karmaBackupDevice.ermState
    ? { ...karmaBackupDevice.ermState, unitId: '001234567890126', recovery: earlierRecovery }
    : null,
};
const unobservedDevice: typeof detailDevice = {
  ...detailDevice,
  id: unobservedDeviceId,
  imei: '001234567890127',
  status: 'IN_STOCK',
  lastReportedAt: null,
  ermRouting: {
    __typename: 'ErmDeviceRouting',
    state: 'UNKNOWN',
    since: null,
    observedAt: null,
    latestKarmaReportAt: null,
    parked: null,
    latestReturnAttempt: null,
  },
  warningLamps: [
    {
      __typename: 'FleetWarningLamp',
      deviceId: unobservedDeviceId,
      parameterId: 1896,
      state: 'UNKNOWN',
      recordedAt: null,
      stateSince: null,
    },
    {
      __typename: 'FleetWarningLamp',
      deviceId: unobservedDeviceId,
      parameterId: 1906,
      state: 'UNKNOWN',
      recordedAt: null,
      stateSince: null,
    },
    {
      __typename: 'FleetWarningLamp',
      deviceId: unobservedDeviceId,
      parameterId: 1910,
      state: 'UNKNOWN',
      recordedAt: null,
      stateSince: null,
    },
  ],
  diagnostics: { __typename: 'FleetDeviceDiagnosticSummary', count: 0, latest: null },
  ermState: null,
};
const overviewDevices = [
  detailDevice,
  reportingDevice,
  karmaBackupDevice,
  uncertainReturnDevice,
  unobservedDevice,
];
graphqlFixture(AdminControlCenterDeviceDocument, (variables) => ({
  fleetDevice:
    overviewDevices.find((device) => device.id === variables.string('id')) ??
    ([settingsWritableDeviceId, settingsBatchDeviceId].includes(variables.string('id') ?? '')
      ? { ...detailDevice, id: variables.requiredString('id') }
      : detailDevice),
}));
graphqlFixture(
  AdminControlCenterReturnToHolitaDocument,
  () =>
    ({
      returnErmDeviceToHolita: {
        __typename: 'ErmKarmaReturnAttempt',
        id: 'return-queued',
        requestedAt: '2026-10-20T08:00:05.000Z',
        status: 'QUEUED',
        pending: true,
        holitaConnectedAt: null,
        recovery: null,
      },
    }) satisfies WithTypename<AdminControlCenterReturnToHolitaMutation>,
);
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

graphqlFixture(AdminControlCenterConfigurationChangesDocument, (variables) => ({
  fleetDevice: {
    __typename: 'FleetDevice',
    id: variables.requiredString('id'),
    ermConfigurationWritesEnabled: [settingsWritableDeviceId, settingsBatchDeviceId].includes(
      variables.string('id') ?? '',
    ),
    ermConfigurationChanges:
      variables.string('id') === settingsBatchDeviceId
        ? [settingsBatchRunFixture]
        : ([
            {
              __typename: 'ErmConfigurationChange',
              id: 'settings-read-edata',
              unitId: fixtureDevice.imei,
              actorId: 'demo-tenant:sample-tenant',
              intent: 'Read eData configuration',
              operation: 'READ_EDATA',
              parameters: [],
              batchId: null,
              batchIndex: null,
              parameter: null,
              status: 'READ',
              startedAt: '2026-10-20T06:45:00.000Z',
              finishedAt: '2026-10-20T06:45:12.000Z',
              failureReason: null,
              baseline: { profile: 'eData' },
              intended: null,
              steps: [
                {
                  name: 'profile',
                  time: '2026-10-20T06:45:12.000Z',
                  outcome: 'READ',
                  payload: null,
                },
              ],
            },
          ] satisfies WithTypename<
            AdminControlCenterConfigurationChangesQuery['fleetDevice']['ermConfigurationChanges']
          >),
  },
}));

const commandRequests = [
  commandPendingFixture,
  commandAcknowledgedFixture,
  commandRejectedFixture,
  commandUnknownFixture,
  commandFailedFixture,
].map((request) => ({ ...request, __typename: 'ErmCommandRequest' }));

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
    queueRequests.find((request) => request.id === variables.requiredString('id')) ??
    commandRequests.find((request) => request.id === variables.requiredString('id')) ??
    null,
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
    total: [reportingDeviceId, unobservedDeviceId].includes(variables.string('id') ?? '') ? 0 : 4,
    offset: variables.int('offset', 0),
    limit: 20,
    counts: {
      __typename: 'FleetProblemCounts',
      asOf: '2026-10-20T08:00:05.000Z',
      dataAsOf: detailEvent.eventTime,
      ermAsOf: '2026-10-20T08:00:05.000Z',
      periodFrom: '2026-10-19T08:00:05.000Z',
      periodTo: '2026-10-20T08:00:05.000Z',
      total: [reportingDeviceId, unobservedDeviceId].includes(variables.string('id') ?? '') ? 0 : 4,
      requiringAttention: [reportingDeviceId, unobservedDeviceId].includes(
        variables.string('id') ?? '',
      )
        ? 0
        : 2,
      recorded: [reportingDeviceId, unobservedDeviceId].includes(variables.string('id') ?? '')
        ? 0
        : 2,
    },
    items: [reportingDeviceId, unobservedDeviceId].includes(variables.string('id') ?? '')
      ? []
      : ([
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
            diagnostics: [],
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
            code: 'DIAGNOSTIC_TROUBLE_CODE',
            details: 'Diagnostic report recorded by the device.',
            diagnostics: [
              {
                __typename: 'FleetProblemDiagnostic',
                kind: 'DIAGNOSTIC_TROUBLE_CODE',
                troubleCode: 'SPN 110 / FMI 0',
                status: 'ADDED',
                report: 419,
                spn: 110,
                fmi: 0,
                systemKey: 'ENGINE',
                descriptionKey: 'faults.spn.coolantTemperature',
                catalogVersion: 'holita-2026-11-06',
                firstObservedAt: '2026-10-20T07:10:00.000Z',
                lastObservedAt: '2026-10-20T07:30:00.000Z',
                occurredAt: '2026-10-20T07:30:00.000Z',
                receivedAt: '2026-10-20T07:30:02.000Z',
              },
              {
                __typename: 'FleetProblemDiagnostic',
                kind: 'DIAGNOSTIC_TROUBLE_CODE',
                troubleCode: 'SPN 4339 / FMI 7',
                status: 'DELETED',
                report: 419,
                spn: 4339,
                fmi: 7,
                systemKey: 'OTHER',
                descriptionKey: null,
                catalogVersion: 'holita-2026-11-06',
                firstObservedAt: '2026-10-20T07:00:00.000Z',
                lastObservedAt: '2026-10-20T07:30:00.000Z',
                occurredAt: '2026-10-20T07:30:00.000Z',
                receivedAt: '2026-10-20T07:30:02.000Z',
              },
            ],
            deviceId: fixtureDevice.id,
            deviceImei: fixtureDevice.imei,
            vehicleId: fixtureDevice.vehicleId,
            alertId: null,
            ermEventId: '11',
            commandRequestId: null,
          },
          {
            __typename: 'FleetProblem',
            id: 'DIAGNOSTIC:12',
            sourceKind: 'DIAGNOSTIC',
            sourceId: '12',
            severity: 'WARNING',
            occurredAt: '2026-10-20T07:00:00.000Z',
            state: 'RECORDED',
            requiringAttention: false,
            code: 'CAN_DISCONNECTED',
            details: null,
            diagnostics: [
              {
                __typename: 'FleetProblemDiagnostic',
                kind: 'CAN_DISCONNECTED',
                troubleCode: null,
                status: null,
                report: 417,
                spn: null,
                fmi: null,
                systemKey: 'OTHER',
                descriptionKey: null,
                catalogVersion: 'holita-2026-11-06',
                firstObservedAt: '2026-10-20T07:00:00.000Z',
                lastObservedAt: '2026-10-20T07:00:00.000Z',
                occurredAt: '2026-10-20T07:00:00.000Z',
                receivedAt: '2026-10-20T07:00:02.000Z',
              },
            ],
            deviceId: fixtureDevice.id,
            deviceImei: fixtureDevice.imei,
            vehicleId: fixtureDevice.vehicleId,
            alertId: null,
            ermEventId: '12',
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
            diagnostics: [],
            deviceId: fixtureDevice.id,
            deviceImei: fixtureDevice.imei,
            vehicleId: fixtureDevice.vehicleId,
            alertId: null,
            ermEventId: null,
            commandRequestId: commandUnknownFixture.id,
          },
        ] satisfies WithTypename<AdminControlCenterDeviceProblemsQuery['fleetProblems']['items']>),
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
          parameterCount: 2,
          unreadParameters: [107],
          readCount: 1,
          failureReason: null,
          values: [
            {
              __typename: 'ErmParameterValue',
              parameter: 593,
              title: 'Simple SMS password',
              outcome: 'READ',
              value: 'password',
              resultCode: null,
            },
            {
              __typename: 'ErmParameterValue',
              parameter: 107,
              title: 'GPRS authentication mode',
              outcome: 'OMITTED',
              value: null,
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
          unreadParameters: [],
          readCount: 1,
          failureReason: null,
          values: [
            {
              __typename: 'ErmParameterValue',
              parameter: 593,
              title: 'Simple SMS password',
              outcome: 'READ',
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

graphqlFixture(AdminControlCenterSettingsDevicesDocument, (variables) => ({
  fleetDevices: {
    __typename: 'FleetDevicePage',
    total: overviewDevices.length,
    offset: variables.int('offset', 0),
    limit: 100,
    items: overviewDevices
      .slice(variables.int('offset', 0), variables.int('offset', 0) + 100)
      .map((device) => ({
        __typename: 'FleetDevice',
        id: device.id,
        imei: device.imei,
        vehicle: device.vehicle,
        ermConfigurationWritesEnabled: true,
        ermState: device.ermState
          ? {
              __typename: 'ErmUnitState',
              online: device.ermState.online,
              mode: device.ermState.mode,
            }
          : null,
      })),
  },
}));
graphqlFixture(
  AdminControlCenterParameterBaselineDocument,
  (variables): WithTypename<AdminControlCenterParameterBaselineQuery> => ({
    fleetDevice: {
      __typename: 'FleetDevice',
      id: variables.requiredString('id'),
      ermParameterSnapshots: {
        __typename: 'ErmParameterSnapshotsPage',
        items: [
          {
            __typename: 'ErmParameterSnapshot',
            id: 'parameter-baseline-settings',
            startedAt: '2026-10-20T07:00:00.000Z',
            status: 'COMPLETE',
            unreadParameters: [107],
            values: [
              {
                __typename: 'ErmParameterValue',
                parameter: 22,
                title: 'Automatic tracking interval',
                value: '300',
                outcome: 'READ',
              },
              {
                __typename: 'ErmParameterValue',
                parameter: 106,
                title: 'TCP keep-alive interval',
                value: '60',
                outcome: 'READ',
              },
              {
                __typename: 'ErmParameterValue',
                parameter: 107,
                title: 'GPRS authentication mode',
                value: null,
                outcome: 'OMITTED',
              },
            ],
          },
        ],
      },
    },
  }),
);

graphqlFixture(AdminControlCenterQueueDeviceLabelsDocument, (variables) => ({
  fleetDevices: {
    __typename: 'FleetDevicePage',
    items: overviewDevices
      .filter((device) => variables.strings('ids')?.includes(device.id))
      .map((device) => ({
        __typename: 'FleetDevice',
        id: device.id,
        imei: device.imei,
        vehicle: device.vehicle,
      })),
  },
}));
