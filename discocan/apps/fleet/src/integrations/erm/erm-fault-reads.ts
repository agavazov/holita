import type {
  DeviceAnsweredFaultRead,
  DeviceAnsweredFaultReads,
  DeviceFaultReadRequest,
} from '@discocan/device-contract';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  boolean,
  date,
  integer,
  integerOrNull,
  recordOf,
  rowsOf,
  text,
} from '../../database/sql.js';
import { newestAnsweredFaultReads, type InspectionCaller } from '../device-adapter.js';
import { isErmRecord, requestErmDashboard, requestErmInternal } from './erm-api.js';

const faultReadsQuery = `query FleetFaultReads($offset: Int!, $limit: Int!, $filter: ErmCommandRequestsFilter!) {
  ermCommandRequests(offset: $offset, limit: $limit, filter: $filter, sort: { field: COMPLETED_AT, direction: DESC }) {
    total
    items { id deviceId unitId completedAt faultReadVerdict { activeCodes codeCount receivedAt } }
  }
}`;

@Injectable()
export class ErmFaultReads {
  /** Asks ERM to queue its allowlisted fault-logger read; false when ERM skips the unit. */
  async requestFaultRead({ device, tenantId, branchId }: DeviceFaultReadRequest): Promise<boolean> {
    const unavailable = () => new ServiceUnavailableException('ERM telemetry is unavailable');
    try {
      const payload = await requestErmInternal(
        `/internal/telemetry/units/${device.imei}/fault-reads`,
        { body: { tenantId, branchId, deviceId: device.id } },
      );
      if (!isErmRecord(payload) || typeof payload.queued !== 'boolean') {
        throw unavailable();
      }
      return payload.queued;
    } catch {
      throw unavailable();
    }
  }

  /**
   * Answered fault-logger reads (GET DTC) with their eData verdicts, newest completion first,
   * created within the period. It forwards the caller's session and Branch, so ERM applies its
   * own Tenant/Branch scope; returns at most `count` requests.
   */
  async faultReads(
    context: InspectionCaller,
    filter: { deviceIds: readonly string[] | null; from: Date; to: Date },
    count: number,
  ): Promise<DeviceAnsweredFaultReads> {
    const { deviceIds } = filter;
    if (deviceIds === null) {
      return this.faultReadsForDevices(context, filter, count);
    }
    const items: DeviceAnsweredFaultRead[] = [];
    let total = 0;
    // ERM accepts at most 100 device IDs per filter.
    for (let start = 0; start < deviceIds.length; start += 100) {
      const batch = await this.faultReadsForDevices(
        context,
        { ...filter, deviceIds: deviceIds.slice(start, start + 100) },
        count,
      );
      total += batch.total;
      items.push(...batch.items);
    }
    return { total, items: newestAnsweredFaultReads(items, count) };
  }

  private async faultReadsForDevices(
    context: InspectionCaller,
    filter: { deviceIds: readonly string[] | null; from: Date; to: Date },
    count: number,
  ): Promise<DeviceAnsweredFaultReads> {
    const { authorization, branchId } = context;
    if (!authorization || !branchId) {
      throw new ServiceUnavailableException('ERM fault reads need a signed-in Branch session');
    }
    const items: DeviceAnsweredFaultRead[] = [];
    let total = 0;
    for (let offset = 0; offset < count; offset += 100) {
      const limit = Math.min(100, count - offset);
      const value = await requestErmDashboard(
        faultReadsQuery,
        {
          offset,
          limit,
          filter: {
            actions: ['READ_EDATA_FAULTS'],
            statuses: ['ANSWERED'],
            ...(filter.deviceIds === null ? {} : { deviceIds: filter.deviceIds }),
            createdFrom: filter.from.toISOString(),
            createdTo: filter.to.toISOString(),
          },
        },
        'ermCommandRequests',
        { authorization, branchId },
      );
      total = integer(value, 'total');
      const rows = rowsOf(value.items, (row) => {
        const verdict = row.faultReadVerdict === null ? null : recordOf(row.faultReadVerdict);
        return {
          id: text(row, 'id'),
          deviceId: text(row, 'deviceId'),
          imei: text(row, 'unitId'),
          completedAt: date(row, 'completedAt'),
          verdict: verdict && {
            activeCodes: boolean(verdict, 'activeCodes'),
            codeCount: integerOrNull(verdict, 'codeCount'),
            receivedAt: date(verdict, 'receivedAt'),
          },
        };
      });
      items.push(...rows);
      if (rows.length < limit || items.length >= total) {
        break;
      }
    }
    return { total, items };
  }
}
