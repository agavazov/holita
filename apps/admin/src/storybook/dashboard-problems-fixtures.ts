import {
  AdminDashboardProblemsDocument,
  type AdminDashboardProblemsQuery,
} from '../generated/graphql/operations';
import { fixtureAlert } from './alerts-fixtures';
import { fixtureDevice } from './devices-fixtures';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';

type Problem = WithTypename<AdminDashboardProblemsQuery['fleetProblems']['items'][number]>;

export const dashboardAsOf = '2026-10-18T07:00:00.000Z';

const alert: Problem = {
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
  vehicleId: fixtureAlert.vehicleId,
  vehicle: fixtureAlert.vehicle,
  deviceId: null,
  deviceImei: null,
  alertId: fixtureAlert.id,
  fleetEventId: fixtureAlert.id,
  ermEventId: null,
  commandRequestId: null,
};

export const dashboardProblems: readonly Problem[] = [
  {
    ...alert,
    id: 'FLEET_ALERT:60000000-0000-4000-8000-000000000002',
    sourceId: '60000000-0000-4000-8000-000000000002',
    alertId: '60000000-0000-4000-8000-000000000002',
    fleetEventId: '60000000-0000-4000-8000-000000000002',
    severity: 'CRITICAL',
    code: 'POWER_DISCONNECTED',
    details: 'The external power supply was disconnected.',
    occurredAt: '2026-10-18T06:58:00.000Z',
  },
  {
    ...alert,
    id: 'COMMAND:91000000-0000-4000-8000-000000000001',
    sourceKind: 'COMMAND',
    sourceId: '91000000-0000-4000-8000-000000000001',
    state: 'UNCERTAIN',
    code: 'TRANSPORT_TIMEOUT',
    details: 'The reply was not received. Check the device before sending again.',
    occurredAt: '2026-10-18T06:55:00.000Z',
    deviceId: fixtureDevice.id,
    deviceImei: fixtureDevice.imei,
    commandRequestId: '91000000-0000-4000-8000-000000000001',
    alertId: null,
    fleetEventId: null,
  },
  {
    ...alert,
    id: 'REPORTING_GAP:60000000-0000-4000-8000-000000000007',
    sourceKind: 'REPORTING_GAP',
    sourceId: '60000000-0000-4000-8000-000000000007',
    code: 'REPORTING_GAP',
    details: 'No device report arrived within the expected interval.',
    occurredAt: '2026-10-18T06:50:00.000Z',
    vehicleId: '50000000-0000-4000-8000-000000000007',
    vehicle: {
      __typename: 'FleetVehicleRef',
      id: '50000000-0000-4000-8000-000000000007',
      licensePlate: 'CB 1007 AX',
    },
    deviceId: '60000000-0000-4000-8000-000000000007',
    deviceImei: '862129080254626',
    alertId: null,
    fleetEventId: null,
  },
  {
    ...alert,
    id: 'COMMAND:91000000-0000-4000-8000-000000000002',
    sourceKind: 'COMMAND',
    sourceId: '91000000-0000-4000-8000-000000000002',
    state: 'FAILED',
    code: 'DEVICE_REJECTED',
    details: 'The device rejected the read request.',
    occurredAt: '2026-10-18T06:40:00.000Z',
    deviceId: fixtureDevice.id,
    deviceImei: fixtureDevice.imei,
    commandRequestId: '91000000-0000-4000-8000-000000000002',
    alertId: null,
    fleetEventId: null,
  },
  alert,
  {
    ...alert,
    id: 'DIAGNOSTIC:92000000-0000-4000-8000-000000000001',
    sourceKind: 'DIAGNOSTIC',
    sourceId: '92000000-0000-4000-8000-000000000001',
    state: 'RECORDED',
    requiringAttention: false,
    code: 'P0130',
    details: 'An oxygen sensor circuit diagnostic was recorded; current fault state is unknown.',
    occurredAt: '2026-10-18T06:20:00.000Z',
    deviceId: fixtureDevice.id,
    deviceImei: fixtureDevice.imei,
    ermEventId: '92000000-0000-4000-8000-000000000001',
    alertId: null,
    fleetEventId: null,
  },
  {
    ...alert,
    id: 'ALARM:92000000-0000-4000-8000-000000000002',
    sourceKind: 'ALARM',
    sourceId: '92000000-0000-4000-8000-000000000002',
    severity: 'INFO',
    state: 'RECORDED',
    requiringAttention: false,
    code: 'IGNITION_ON',
    details: 'An ignition alarm was recorded by the device.',
    occurredAt: '2026-10-18T06:10:00.000Z',
    deviceId: fixtureDevice.id,
    deviceImei: fixtureDevice.imei,
    ermEventId: '92000000-0000-4000-8000-000000000002',
    alertId: null,
    fleetEventId: null,
  },
];

/** Finite snapshots keep the combined feed and its source/state filters inspectable. */
graphqlFixture(AdminDashboardProblemsDocument, (variables) => {
  const filter = variables.object('filter');
  const sources = filter.strings('sourceKinds');
  const severities = filter.strings('severities');
  const states = filter.strings('states');
  const attention = filter.boolean('requiringAttention');
  const vehicleIds = filter.strings('vehicleIds');
  const deviceIds = filter.strings('deviceIds');
  const periodFrom = filter.string('occurredFrom') ?? '2026-10-17T07:00:00.000Z';
  const periodTo = filter.string('occurredTo') ?? dashboardAsOf;
  const rows = dashboardProblems.filter(
    (item) =>
      (!sources?.length || sources.includes(item.sourceKind)) &&
      (!severities?.length || severities.includes(item.severity)) &&
      (!states?.length || states.includes(item.state)) &&
      (attention === null || item.requiringAttention === attention) &&
      (!vehicleIds?.length || (item.vehicleId !== null && vehicleIds.includes(item.vehicleId))) &&
      (!deviceIds?.length || (item.deviceId !== null && deviceIds.includes(item.deviceId))) &&
      (item.sourceKind === 'FLEET_ALERT' ||
        item.sourceKind === 'REPORTING_GAP' ||
        (item.occurredAt >= periodFrom && item.occurredAt < periodTo)),
  );
  const offset = variables.int('offset', 0);
  const limit = variables.int('limit', 20);
  return {
    fleetProblems: {
      __typename: 'FleetProblemPage',
      items: rows.slice(offset, offset + limit),
      total: rows.length,
      offset,
      limit,
      counts: {
        __typename: 'FleetProblemCounts',
        asOf: dashboardAsOf,
        dataAsOf: dashboardAsOf,
        ermAsOf: dashboardAsOf,
        periodFrom,
        periodTo,
        total: rows.length,
        requiringAttention: rows.filter((item) => item.requiringAttention).length,
        recorded: rows.filter((item) => item.state === 'RECORDED').length,
        bySeverity: (['CRITICAL', 'WARNING', 'INFO'] as const).map((severity) => ({
          __typename: 'FleetProblemSeverityCount',
          severity,
          total: rows.filter((item) => item.severity === severity).length,
          requiringAttention: rows.filter(
            (item) => item.severity === severity && item.requiringAttention,
          ).length,
          recorded: rows.filter((item) => item.severity === severity && item.state === 'RECORDED')
            .length,
        })),
        bySource: (['FLEET_ALERT', 'DIAGNOSTIC', 'ALARM', 'REPORTING_GAP', 'COMMAND'] as const).map(
          (sourceKind) => ({
            __typename: 'FleetProblemSourceCount',
            sourceKind,
            total: rows.filter((item) => item.sourceKind === sourceKind).length,
            requiringAttention: rows.filter(
              (item) => item.sourceKind === sourceKind && item.requiringAttention,
            ).length,
            recorded: rows.filter(
              (item) => item.sourceKind === sourceKind && item.state === 'RECORDED',
            ).length,
          }),
        ),
      },
    },
  };
});
