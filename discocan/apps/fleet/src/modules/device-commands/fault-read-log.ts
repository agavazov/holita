import { Injectable } from '@nestjs/common';
import { DevicesRepository } from '../devices/devices.repository.js';
import type { FleetFaultLogEntry } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import type { FleetScope } from '../../validation.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';

@Injectable()
export class FaultReadLog {
  constructor(
    private readonly devices: DevicesRepository,
    private readonly adapters: DeviceAdapters,
  ) {}

  async entries(
    context: RequestContext,
    scope: FleetScope,
    filter: { vehicleIds: readonly string[] | undefined; from: Date; to: Date },
    count: number,
  ): Promise<{
    total: number;
    items: (Omit<FleetFaultLogEntry, 'vehicle'> & { vehicleId: string | null })[];
  }> {
    const { vehicleIds, from, to } = filter;
    const devices = await this.devices.forAnsweredFaultReads(
      scope,
      this.adapters.enabledTypes('answeredFaultReads'),
      vehicleIds,
    );
    if (devices.length === 0) {
      return { total: 0, items: [] };
    }
    const byDevice = new Map(devices.map((device) => [device.id, device.vehicleId]));
    const pages = await Promise.all(
      [...this.adapters.group(devices, 'answeredFaultReads')].map(([type, group]) =>
        this.adapters
          .for(type)
          .answeredFaultReads(
            { ...scope, deviceIds: group.map(({ id }) => id), from, to, count },
            context,
          ),
      ),
    );
    return {
      total: pages.reduce((total, page) => total + page.total, 0),
      items: pages
        .flatMap(({ items }) => items)
        .map((read) => ({
          id: `read:${read.id}`,
          kind: 'FAULT_READ',
          occurredAt: read.completedAt,
          vehicleId: byDevice.get(read.deviceId) ?? null,
          deviceImei: read.imei,
          troubleCode: null,
          spn: null,
          fmi: null,
          descriptionKey: null,
          parameterId: null,
          lampState: null,
          activeCodes: read.verdict?.activeCodes ?? null,
          codeCount: read.verdict?.codeCount ?? null,
          valueCount: null,
        })),
    };
  }
}
