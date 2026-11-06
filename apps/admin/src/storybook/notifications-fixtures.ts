import {
  AdminMarkAllNotificationsReadDocument,
  AdminMarkNotificationReadDocument,
  AdminNotificationsDocument,
  type AdminNotificationFragment,
} from '../generated/graphql/operations';
import { fixtureError, graphqlFixture, type WithTypename } from './graphql-fixtures';
import { defaultBranchId } from './session-fixtures';

const vehicleId = '50000000-0000-4000-8000-000000000001';
const deviceId = '60000000-0000-4000-8000-000000000001';
const alertId = '60000000-0000-4000-8000-000000000001';
const commandId = '91000000-0000-4000-8000-000000000001';
const parameters: AdminNotificationFragment['parameters'] = {
  eventKind: null,
  alertStatus: null,
  transition: null,
  troubleCode: null,
  diagnosticStatus: null,
  alarmCode: null,
  commandKind: null,
  commandStatus: null,
  reasonCode: null,
};
const alert: WithTypename<AdminNotificationFragment> = {
  __typename: 'FleetNotification',
  id: 'a1000000-0000-4000-8000-000000000001',
  branchId: defaultBranchId,
  sourceKind: 'FLEET_ALERT',
  sourceKey: `${alertId}:OPEN:2026-10-18T06:58:00.000Z`,
  category: 'ALERT',
  severity: 'CRITICAL',
  occurredAt: '2026-10-18T06:58:00.000Z',
  createdAt: '2026-10-18T06:58:01.000Z',
  wordingKey: 'fleet.alert.transition',
  parameters: { ...parameters, eventKind: 'LOW_FUEL', alertStatus: 'OPEN', transition: 'OPEN' },
  vehicleId,
  deviceId: null,
  alertId,
  ermEventId: null,
  commandRequestId: null,
  readAt: null,
};

export const fixtureNotifications: readonly WithTypename<AdminNotificationFragment>[] = [
  alert,
  {
    ...alert,
    id: 'a1000000-0000-4000-8000-000000000002',
    sourceKind: 'DIAGNOSTIC',
    sourceKey: 'recorded-diagnostic:P0299:2026-10-18T06:50:00.000Z',
    category: 'DEVICE',
    severity: 'WARNING',
    occurredAt: '2026-10-18T06:50:00.000Z',
    wordingKey: 'notification.recordedDiagnostic',
    parameters: {
      ...parameters,
      troubleCode: 'SPN 102 FMI 4',
      diagnosticStatus: 'ADDED',
      eventKind: 'DIAGNOSTIC_TROUBLE_CODE',
    },
    alertId: null,
    deviceId,
    ermEventId: '92000000-0000-4000-8000-000000000001',
  },
  {
    ...alert,
    id: 'a1000000-0000-4000-8000-000000000003',
    sourceKind: 'COMMAND',
    sourceKey: `erm-command:${commandId}:OUTCOME_UNKNOWN`,
    category: 'COMMAND',
    severity: 'WARNING',
    occurredAt: '2026-10-18T06:40:00.000Z',
    wordingKey: 'notification.commandOutcome',
    parameters: {
      ...parameters,
      commandKind: 'READ_STATUS',
      commandStatus: 'OUTCOME_UNKNOWN',
      reasonCode: 'REPLY_TIMEOUT',
    },
    deviceId,
    alertId: null,
    commandRequestId: commandId,
  },
  {
    ...alert,
    id: 'a1000000-0000-4000-8000-000000000004',
    sourceKind: 'ALARM',
    sourceKey: 'recorded-alarm:POWER_DISCONNECTED:2026-10-18T06:30:00.000Z',
    category: 'DEVICE',
    severity: 'WARNING',
    occurredAt: '2026-10-18T06:30:00.000Z',
    wordingKey: 'notification.recordedAlarm',
    parameters: { ...parameters, alarmCode: 'POWER_DISCONNECTED' },
    deviceId,
    alertId: null,
    ermEventId: '92000000-0000-4000-8000-000000000002',
    readAt: '2026-10-18T06:35:00.000Z',
  },
];

/** Small transport snapshots for feed stories, including per-story receipt state. */
export function notificationFixtures(empty = false): void {
  const items = empty ? [] : fixtureNotifications;
  const read = new Set(items.filter((item) => item.readAt !== null).map((item) => item.id));
  const row = (item: WithTypename<AdminNotificationFragment>) => ({
    ...item,
    readAt: read.has(item.id) ? '2026-10-18T07:00:00.000Z' : null,
  });
  graphqlFixture(AdminNotificationsDocument, (variables) => {
    const filter = variables.object('filter');
    const categories = filter.strings('categories');
    const search = variables.string('search')?.toLowerCase();
    const rows = items.filter(
      (item) =>
        (filter.string('readState') !== 'UNREAD' || !read.has(item.id)) &&
        (!categories?.length || categories.includes(item.category)) &&
        (!search || `${item.sourceKey} ${item.wordingKey}`.toLowerCase().includes(search)),
    );
    const offset = variables.int('offset', 0);
    const limit = variables.int('limit', 20);
    return {
      notifications: {
        __typename: 'FleetNotificationPage',
        items: rows.slice(offset, offset + limit).map(row),
        total: rows.length,
        unreadCount: items.filter((item) => !read.has(item.id)).length,
        offset,
        limit,
      },
    };
  });
  graphqlFixture(AdminMarkNotificationReadDocument, (variables) => {
    const item = items.find((item) => item.id === variables.string('id'));
    if (!item) {
      throw fixtureError('NOT_FOUND', 'The notification was not found.');
    }
    read.add(item.id);
    return { markNotificationRead: row(item) };
  });
  graphqlFixture(AdminMarkAllNotificationsReadDocument, () => {
    const count = items.filter((item) => !read.has(item.id)).length;
    items.forEach((item) => read.add(item.id));
    return { markAllNotificationsRead: count };
  });
}

notificationFixtures();
