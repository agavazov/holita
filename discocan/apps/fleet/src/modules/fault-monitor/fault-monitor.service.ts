import { Injectable } from '@nestjs/common';
import { FleetClock } from '../../clock/fleet-clock.js';
import type {
  FleetFaultLogEntry,
  FleetFaultLogKind,
  FleetFaultLogPage,
  FleetFaultMonitorVehicle,
  FleetWarningLampState,
  QueryFleetFaultLogArgs,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { ErmDashboardClient } from '../../integrations/erm/erm-dashboard.client.js';
import {
  dateTimeRange,
  enumFilter,
  idList,
  invalid,
  pagination,
  requireScope,
} from '../../validation.js';
import { DevicesService, type DeviceResult } from '../devices/devices.service.js';
import { faultMeaning } from '../events/fault-meanings.js';
import { WARNING_LAMP_NAMES } from '../notifications/warning-lamp-notifications.js';
import { FaultCheckRepository } from '../vehicles/fault-check.repository.js';
import { FaultMonitorRepository, STORED_FAULT_LOG_KINDS } from './fault-monitor.repository.js';

const KINDS: readonly FleetFaultLogKind[] = [...STORED_FAULT_LOG_KINDS, 'FAULT_READ'];
const LAMP_STATES: readonly FleetWarningLampState[] = [
  'UNKNOWN',
  'OFF',
  'RED',
  'YELLOW',
  'INFORMATION',
  'NOT_AVAILABLE',
  'RESERVED',
];
const DAY = 86_400_000;

type MonitorVehicle = Omit<FleetFaultMonitorVehicle, 'devices'> & { devices: DeviceResult[] };

function newestFirst(left: { occurredAt: Date; id: string }, right: typeof left): number {
  return (
    right.occurredAt.getTime() - left.occurredAt.getTime() ||
    (right.id < left.id ? -1 : right.id > left.id ? 1 : 0)
  );
}

@Injectable()
export class FaultMonitorService {
  constructor(
    private readonly monitor: FaultMonitorRepository,
    private readonly devices: DevicesService,
    private readonly faultChecks: FaultCheckRepository,
    private readonly erm: ErmDashboardClient,
    private readonly clock: FleetClock,
  ) {}

  async vehicles(context: RequestContext): Promise<MonitorVehicle[]> {
    const scope = requireScope(context);
    const rows = await this.monitor.vehicles(scope);
    const vehicleIds = rows.map((row) => row.vehicle.id);
    const [devices, checks] = await Promise.all([
      this.devices.forVehicles(scope, vehicleIds),
      this.faultChecks.forVehicles(scope, vehicleIds),
    ]);
    return rows.map((row) => ({
      ...row,
      devices: devices
        .filter((device) => device.vehicleId === row.vehicle.id)
        .sort(
          (left, right) =>
            (right.lastReportedAt?.getTime() ?? 0) - (left.lastReportedAt?.getTime() ?? 0),
        ),
      faultCheck: checks.get(row.vehicle.id) ?? null,
    }));
  }

  /**
   * Stored entries and ERM's answered fault reads, merged newest first. Each source supplies its
   * first offset + limit entries, which always contain the requested page of the merged order.
   */
  async log(context: RequestContext, args: QueryFleetFaultLogArgs): Promise<FleetFaultLogPage> {
    const scope = requireScope(context);
    const { offset, limit } = pagination(args);
    const filter = args.filter;
    const vehicleIds = idList(filter?.vehicleIds, 'vehicleIds');
    const kinds = enumFilter(filter?.kinds, KINDS, 'kinds') ?? KINDS;
    const range = dateTimeRange(filter?.occurredFrom, filter?.occurredTo, {
      from: 'occurredFrom',
      to: 'occurredTo',
    });
    const to = range.to ?? this.clock.now();
    const from = range.from ?? new Date(to.getTime() - 7 * DAY);
    if (from >= to) {
      invalid('filter', 'filter.occurredTo must be after filter.occurredFrom.', 'INVALID_RANGE');
    }
    if (to.getTime() - from.getTime() > 93 * DAY) {
      invalid('filter', 'Choose a period of at most 93 days.', 'BOUNDED_PERIOD_REQUIRED');
    }
    const reads = kinds.includes('FAULT_READ');
    const storedKinds = STORED_FAULT_LOG_KINDS.filter((kind) => kinds.includes(kind));
    const stored = storedKinds.length
      ? await this.monitor.log(scope, {
          vehicleIds,
          kinds: storedKinds,
          from,
          to,
          offset: reads ? 0 : offset,
          limit: reads ? offset + limit : limit,
        })
      : { total: 0, entries: [] };
    const devices = reads ? await this.monitor.devices(scope, vehicleIds) : [];
    const faultReads =
      reads && (vehicleIds === undefined || devices.length > 0)
        ? await this.erm.faultReads(
            context,
            {
              deviceIds: vehicleIds === undefined ? null : devices.map((device) => device.id),
              from,
              to,
            },
            offset + limit,
          )
        : { total: 0, items: [] };

    const entries = [
      ...stored.entries.map(
        (entry): Omit<FleetFaultLogEntry, 'vehicle'> & { vehicleId: string | null } => {
          const parameterId =
            [...WARNING_LAMP_NAMES].find(([, name]) => name === entry.lamp)?.[0] ?? null;
          return {
            id: entry.id,
            kind: entry.kind,
            occurredAt: entry.occurredAt,
            vehicleId: entry.vehicleId,
            deviceImei: entry.deviceImei,
            troubleCode: entry.troubleCode,
            spn: entry.spn,
            fmi: entry.fmi,
            descriptionKey:
              entry.kind === 'FAULT_ADDED' || entry.kind === 'FAULT_REMOVED'
                ? faultMeaning(entry.spn).descriptionKey
                : null,
            parameterId,
            lampState: LAMP_STATES.find((state) => state === entry.lampState) ?? null,
            activeCodes: null,
            codeCount: null,
            valueCount: entry.valueCount,
          };
        },
      ),
      ...faultReads.items.map(
        (read): Omit<FleetFaultLogEntry, 'vehicle'> & { vehicleId: string | null } => ({
          id: `read:${read.id}`,
          kind: 'FAULT_READ',
          occurredAt: read.completedAt,
          vehicleId: devices.find((device) => device.id === read.deviceId)?.vehicleId ?? null,
          deviceImei: read.unitId,
          troubleCode: null,
          spn: null,
          fmi: null,
          descriptionKey: null,
          parameterId: null,
          lampState: null,
          activeCodes: read.verdict?.activeCodes ?? null,
          codeCount: read.verdict?.codeCount ?? null,
          valueCount: null,
        }),
      ),
    ]
      .sort(newestFirst)
      .slice(reads ? offset : 0, (reads ? offset : 0) + limit);
    const refs = await this.monitor.vehicleRefs(scope, [
      ...new Set(entries.flatMap((entry) => (entry.vehicleId ? [entry.vehicleId] : []))),
    ]);
    return {
      items: entries.map(({ vehicleId, ...entry }) => ({
        ...entry,
        vehicle: refs.find((vehicle) => vehicle.id === vehicleId) ?? null,
      })),
      total: stored.total + faultReads.total,
      offset,
      limit,
    };
  }
}
