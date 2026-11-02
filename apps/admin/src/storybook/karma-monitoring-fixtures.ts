import {
  AdminKarmaMonitoringSettingsDocument,
  AdminKarmaMonitoringTrucksDocument,
  AdminKarmaMonitoringEventsDocument,
  AdminUpdateKarmaMonitoringSettingsDocument,
  type KarmaMonitoringEventFragment,
  type AdminKarmaMonitoringTrucksQuery,
  type KarmaMonitoringSettingsFragment,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';

export const monitoringSettings: KarmaMonitoringSettingsFragment = {
  enabled: true,
  statusPollSeconds: 60,
  offlineAfterMinutes: 15,
  faultHistoryPollMinutes: 60,
  faultCommandEnabled: true,
  faultCommandMinutes: 60,
  retentionDays: 10,
};
const event: WithTypename<KarmaMonitoringEventFragment> = {
  __typename: 'FleetKarmaMonitoringEvent',
  id: 'report-1',
  karmaCarId: '41',
  kind: 'FAULT_REPORTED',
  source: 'KARMA_HISTORY',
  occurredAt: '2026-11-02T11:50:00.000Z',
  recordedAt: '2026-11-02T11:51:00.000Z',
  code: 'SPN 110 / FMI 3',
  spn: 110,
  fmi: 3,
  faultStatus: 'ADDED',
  commandOutcome: null,
  operationId: null,
  rawRecord: '{"message_id":3000000601,"data":"419D...","status":"ADDED","spn":110,"fmi":3}',
  details: null,
};
const events: readonly WithTypename<KarmaMonitoringEventFragment>[] = [
  event,
  {
    ...event,
    id: 'read-1',
    kind: 'FAULT_READ_ANSWERED',
    source: 'DEVICE_COMMAND',
    code: null,
    spn: null,
    fmi: null,
    faultStatus: null,
    commandOutcome: 'NOT_ACKNOWLEDGED',
    operationId: 'operation-1',
    rawRecord: '{"response":"NACK"}',
  },
  {
    ...event,
    id: 'report-2',
    karmaCarId: '57',
    code: 'P0123',
    spn: null,
    fmi: null,
    faultStatus: 'REMOVED',
    occurredAt: '2026-11-02T10:00:00.000Z',
    rawRecord: '{"code":"P0123","status":"REMOVED"}',
  },
  {
    ...event,
    id: 'no-data-1',
    karmaCarId: '57',
    kind: 'NO_DATA_SINCE',
    source: 'STATUS_POLL',
    code: null,
    spn: null,
    fmi: null,
    faultStatus: null,
    occurredAt: '2026-11-02T09:20:00.000Z',
    rawRecord: '{"noDataSince":"2026-11-02T09:05:00.000Z"}',
  },
];
type Truck = WithTypename<
  AdminKarmaMonitoringTrucksQuery['fleetKarmaMonitoringTrucks']['items'][number]
>;
const trucks: readonly Truck[] = [
  {
    __typename: 'FleetKarmaMonitoringTruck',
    id: 'truck-41',
    karmaCarId: '41',
    displayName: 'CB 4821 PK',
    online: true,
    lastDataAt: '2026-11-02T11:59:00.000Z',
    noDataSince: null,
    faults: [{ id: event.id }],
    latestFault: { code: event.code },
    lastCommandOutcome: 'NOT_ACKNOWLEDGED',
    lastCommandRequestedAt: '2026-11-02T11:45:00.000Z',
    lastCommandCompletedAt: '2026-11-02T11:46:00.000Z',
  },
  {
    __typename: 'FleetKarmaMonitoringTruck',
    id: 'truck-57',
    karmaCarId: '57',
    displayName: 'PB 9082 AT',
    online: false,
    lastDataAt: '2026-11-02T09:05:00.000Z',
    noDataSince: '2026-11-02T09:05:00.000Z',
    faults: [{ id: 'report-2' }],
    latestFault: { code: 'P0123' },
    lastCommandOutcome: 'FAULTS',
    lastCommandRequestedAt: '2026-11-02T08:00:00.000Z',
    lastCommandCompletedAt: '2026-11-02T08:02:00.000Z',
  },
  {
    __typename: 'FleetKarmaMonitoringTruck',
    id: 'truck-63',
    karmaCarId: '63',
    displayName: 'CA 7300 BX',
    online: true,
    lastDataAt: '2026-11-02T11:58:00.000Z',
    noDataSince: null,
    faults: [],
    latestFault: null,
    lastCommandOutcome: null,
    lastCommandRequestedAt: null,
    lastCommandCompletedAt: null,
  },
];

/** Storybook snapshots only; the product has no fixture transport. */
export function registerMonitoringFixtures(
  mode: 'default' | 'disabled' | 'empty' | 'paginated' = 'default',
): void {
  graphqlFixture(AdminKarmaMonitoringSettingsDocument, () => ({
    fleetKarmaMonitoringSettings: {
      __typename: 'FleetKarmaMonitoringSettings',
      ...monitoringSettings,
      enabled: mode !== 'disabled',
    },
    fleetSettings: { __typename: 'FleetSettings', timeZone: 'Europe/Sofia' },
  }));
  graphqlFixture(AdminKarmaMonitoringTrucksDocument, (v) => {
    const filter = v.object('filter');
    const items =
      mode === 'empty'
        ? []
        : trucks.filter(
            (truck) =>
              (filter.boolean('online') === null || truck.online === filter.boolean('online')) &&
              (filter.boolean('withFaults') === null ||
                truck.faults.length > 0 === filter.boolean('withFaults')),
          );
    return {
      fleetKarmaMonitoringTrucks: {
        items,
        total: items.length,
        offset: v.int('offset', 0),
        limit: v.int('limit', 20),
        onlineTotal: mode === 'empty' ? 0 : 2,
        noDataTotal: mode === 'empty' ? 0 : 1,
        withFaultsTotal: mode === 'empty' ? 0 : 2,
      },
    };
  });
  graphqlFixture(AdminKarmaMonitoringEventsDocument, (v) => {
    const kinds = v.object('filter').strings('kinds');
    const truck = v.object('filter').string('karmaCarId');
    const items =
      mode === 'empty'
        ? []
        : events.filter(
            (row) =>
              (!kinds?.length || kinds.includes(row.kind)) && (!truck || row.karmaCarId === truck),
          );
    return {
      fleetKarmaMonitoringEvents: {
        items,
        total: mode === 'paginated' ? 63 : items.length,
        offset: v.int('offset', 0),
        limit: v.int('limit', 20),
      },
    };
  });
  graphqlFixture(AdminUpdateKarmaMonitoringSettingsDocument, (v) => {
    const input = v.object('input');
    return {
      updateFleetKarmaMonitoringSettings: {
        __typename: 'FleetKarmaMonitoringSettings',
        enabled: input.boolean('enabled') ?? false,
        faultCommandEnabled: input.boolean('faultCommandEnabled') ?? false,
        statusPollSeconds: input.int('statusPollSeconds', 60),
        offlineAfterMinutes: input.int('offlineAfterMinutes', 15),
        faultHistoryPollMinutes: input.int('faultHistoryPollMinutes', 60),
        faultCommandMinutes: input.int('faultCommandMinutes', 60),
        retentionDays: input.int('retentionDays', 10),
      },
    };
  });
}
