import {
  AdminControlCenterDeviceDocument,
  AdminControlCenterEventsDocument,
  type AdminControlCenterDeviceQuery,
  type AdminControlCenterDevicesQuery,
  type AdminControlCenterEventsQuery,
  AdminControlCenterSmsDevicesDocument,
  AdminControlCenterDevicesDocument,
  type AdminControlCenterSmsDevicesQuery,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';
import { fixtureDevice, fixtureLiveDevice } from './devices-fixtures';

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
  latestRecoveryAttempt: null,
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
  fleetKarmaMonitoringTrucks: {
    __typename: 'FleetKarmaMonitoringTruckPage',
    items: [
      {
        __typename: 'FleetKarmaMonitoringTruck',
        id: 'karma-truck',
        karmaDeviceId: fixtureDevice.imei,
        online: false,
        lastDataAt: '2026-10-20T07:59:00.000Z',
      },
    ],
  },
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
    health: { overdue: false, karmaRoutingWritesLast24h: 0 },
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
    health: { overdue: true, karmaRoutingWritesLast24h: 0 },
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
