import type { AdminFaultMonitorQuery } from '../../../../generated/graphql/operations';
import type { StatusTone } from '../../../theme/status-tones';
import {
  faultReadState,
  type FleetFaultFinding,
  type FleetFaultRead,
} from '../../../ui/fleet-live/fault-wording';

export type FaultMonitorRow = AdminFaultMonitorQuery['fleetFaultMonitor'][number];

/** List order: active codes, trucks that cannot be verified now, offline, then clear. */
export const truckFaultStates = ['ACTIVE', 'NO_CAN', 'NOT_CHECKED', 'OFFLINE', 'CLEAR'] as const;
export type TruckFaultState = (typeof truckFaultStates)[number];
export type CanState = 'DATA' | 'LOST' | 'NONE';

export interface FaultTruck {
  readonly id: string;
  readonly plate: string;
  readonly state: TruckFaultState;
  /** Fault-logger codes and unresolved alerts with a code from the latest fault check. */
  readonly codes: readonly FleetFaultFinding[];
  readonly lastRead: FleetFaultRead | null;
  readonly pendingRead: FleetFaultRead | null;
  readonly lastDataAt: string | null;
  readonly can: CanState;
  readonly canAt: string | null;
}

const HOUR = 3_600_000;
/** eData 405 values arrive every one to three minutes while CAN data flows. */
const CAN_FRESH = 15 * 60_000;

export const truckStateTone: Readonly<Record<TruckFaultState, StatusTone>> = {
  ACTIVE: 'danger',
  OFFLINE: 'neutral',
  NO_CAN: 'warn',
  CLEAR: 'success',
  NOT_CHECKED: 'info',
};

function newest(values: readonly (string | null | undefined)[]): string | null {
  return values.reduce<string | null>(
    (latest, value) => (value && (latest === null || value > latest) ? value : latest),
    null,
  );
}

function canState(row: FaultMonitorRow, now: number): { can: CanState; canAt: string | null } {
  const data = row.canDataAt ?? null;
  const lost = row.canLostAt ?? null;
  if (lost !== null && (data === null || Date.parse(lost) > Date.parse(data))) {
    return { can: 'LOST', canAt: lost };
  }
  return data !== null && now - Date.parse(data) <= CAN_FRESH
    ? { can: 'DATA', canAt: data }
    : { can: 'NONE', canAt: data };
}

/**
 * The first state that applies: active codes, whether or not the truck is reachable; offline;
 * no CAN data; a clear verdict within the last hour; otherwise not checked. A clear verdict needs
 * CAN data, because an empty fault buffer proves nothing without it.
 */
export function faultTruck(row: FaultMonitorRow, now: number): FaultTruck {
  const reads = faultReadState(
    row.devices.flatMap((device) => device.ermCommandRequests),
    now,
  );
  const verdict = reads.last?.faultReadVerdict ?? null;
  const codes = (row.faultCheck?.findings ?? []).filter(
    (finding) => finding.source === 'FAULT_LOGGER' || finding.source === 'ALERT',
  );
  const { can, canAt } = canState(row, now);
  const online = row.devices.some((device) => device.ermState?.online === true);
  const state: TruckFaultState =
    codes.length > 0 || verdict?.activeCodes === true
      ? 'ACTIVE'
      : !online
        ? 'OFFLINE'
        : can !== 'DATA'
          ? 'NO_CAN'
          : verdict && now - Date.parse(verdict.receivedAt) <= HOUR
            ? 'CLEAR'
            : 'NOT_CHECKED';
  return {
    id: row.vehicle.id,
    plate: row.vehicle.licensePlate,
    state,
    codes,
    lastRead: reads.last,
    pendingRead: reads.pending,
    lastDataAt: newest(row.devices.map((device) => device.lastReportedAt)),
    can,
    canAt,
  };
}

/** Trucks in state order, then by license plate. */
export function faultTrucks(rows: readonly FaultMonitorRow[], now: number): FaultTruck[] {
  return rows
    .map((row) => faultTruck(row, now))
    .sort(
      (left, right) =>
        truckFaultStates.indexOf(left.state) - truckFaultStates.indexOf(right.state) ||
        left.plate.localeCompare(right.plate),
    );
}
