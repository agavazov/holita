import {
  AdminAcknowledgeAlertDocument,
  AdminAcknowledgeAlertsDocument,
  AdminAlertCountsDocument,
  AdminAlertDocument,
  AdminAlertsDataClockDocument,
  AdminAlertsDocument,
  AdminAlertVehiclesDocument,
  AdminReopenAlertDocument,
  AdminResolveAlertDocument,
  type AdminAlertDetailsFragment,
} from '../generated/graphql/operations';
import {
  fixtureError,
  graphqlFixture,
  type FixtureVariables,
  type WithTypename,
} from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';
const at = '2026-10-18T07:00:00.000Z';
export const fixtureAlert: WithTypename<AdminAlertDetailsFragment> = {
  __typename: 'FleetEvent',
  id: '60000000-0000-4000-8000-000000000001',
  branchId: defaultBranchId,
  vehicleId: '50000000-0000-4000-8000-000000000001',
  vehicle: {
    __typename: 'FleetVehicleRef',
    id: '50000000-0000-4000-8000-000000000001',
    licensePlate: 'CB 1001 AX',
  },
  driverId: '40000000-0000-4000-8000-000000000001',
  driver: {
    __typename: 'FleetDriverRef',
    id: '40000000-0000-4000-8000-000000000001',
    firstName: 'Elena',
    lastName: 'Petrova',
  },
  tripId: null,
  occurredAt: '2026-10-18T06:30:00.000Z',
  kind: 'LOW_FUEL',
  severity: 'WARNING',
  alertStatus: 'OPEN',
  details: 'Fuel level is below the configured threshold.',
  remark: 'Investigate at the next stop.',
  acknowledgedAt: null,
  resolvedAt: null,
  address: 'Sofia, Bulgaria',
  measuredValue: 8,
  thresholdValue: 12,
  measurementUnit: 'PERCENT',
  troubleCode: null,
};
const otherAlert: WithTypename<AdminAlertDetailsFragment> = {
  ...fixtureAlert,
  id: '60000000-0000-4000-8000-000000000002',
  kind: 'POWER_DISCONNECTED',
  severity: 'CRITICAL',
  details: 'The external power supply was disconnected.',
  remark: null,
};
const resolved: WithTypename<AdminAlertDetailsFragment> = {
  ...fixtureAlert,
  id: '60000000-0000-4000-8000-000000000003',
  alertStatus: 'RESOLVED',
  resolvedAt: at,
};
const records = [fixtureAlert, otherAlert, resolved];
function find(variables: FixtureVariables) {
  const record = records.find((record) => record.id === variables.requiredString('id'));
  if (!record) {
    throw fixtureError('NOT_FOUND', 'The alert was not found.');
  }
  return record;
}
// Fixed read snapshots exercise routing/transport and workflow responses. Refetch returns the
// same initial rows after writes; backend/browser checks prove filtering and persistence.
graphqlFixture(AdminAlertsDocument, (variables) => ({
  fleetEvents: {
    __typename: 'FleetEventPage',
    items: [fixtureAlert, otherAlert],
    total: 2,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 20),
  },
}));
graphqlFixture(AdminAlertDocument, (variables) => ({ fleetEvent: find(variables) }));
graphqlFixture(AdminAlertCountsDocument, () => ({
  fleetAlertCounts: {
    __typename: 'FleetAlertCounts',
    open: 2,
    openCritical: 1,
    acknowledged: 0,
    resolved: 1,
  },
}));
graphqlFixture(AdminAlertsDataClockDocument, () => ({
  fleetDataClock: {
    __typename: 'FleetDataClock',
    asOf: at,
    businessDate: '2026-10-18',
    timeZone: 'Europe/Sofia',
  },
}));
graphqlFixture(AdminAlertVehiclesDocument, (variables) => ({
  fleetVehicles: {
    __typename: 'FleetVehiclePage',
    items: [
      {
        __typename: 'FleetVehicle',
        id: fixtureAlert.vehicleId,
        licensePlate: fixtureAlert.vehicle.licensePlate,
      },
    ],
    total: 1,
    offset: variables.int('offset', 0),
    limit: variables.int('limit', 100),
  },
}));
graphqlFixture(AdminAcknowledgeAlertsDocument, (variables) => {
  const ids = variables.strings('ids') ?? [];
  return {
    acknowledgeFleetAlerts: {
      __typename: 'FleetAlertActionResult',
      succeededIds: ids.filter((id) => id === fixtureAlert.id),
      failures: ids
        .filter((id) => id !== fixtureAlert.id)
        .map((id) => ({
          __typename: 'FleetAlertActionFailure',
          id,
          code: 'CONFLICT',
          message: 'The alert changed meanwhile.',
        })),
    },
  };
});
function changed(
  variables: FixtureVariables,
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED',
): WithTypename<AdminAlertDetailsFragment> {
  const record = find(variables);
  const input = variables.object('input');
  if (input.string('expectedStatus') !== record.alertStatus) {
    throw fixtureError('CONFLICT', 'The alert changed meanwhile.');
  }
  return {
    ...record,
    alertStatus: status,
    remark: input.has('remark') ? input.string('remark') : record.remark,
    acknowledgedAt: status === 'ACKNOWLEDGED' ? at : record.acknowledgedAt,
    resolvedAt: status === 'RESOLVED' ? at : null,
  };
}
graphqlFixture(AdminAcknowledgeAlertDocument, (variables) => ({
  acknowledgeFleetAlert: changed(variables, 'ACKNOWLEDGED'),
}));
graphqlFixture(AdminResolveAlertDocument, (variables) => ({
  resolveFleetAlert: changed(variables, 'RESOLVED'),
}));
graphqlFixture(AdminReopenAlertDocument, (variables) => ({
  reopenFleetAlert: changed(variables, 'OPEN'),
}));
