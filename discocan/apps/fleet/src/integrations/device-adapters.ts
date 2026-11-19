import { Injectable } from '@nestjs/common';
import type { DeviceLiveSnapshot } from '@discocan/device-contract';
import { FleetDeviceType } from '../generated/prisma/enums.js';
import type { DeviceAdapter } from './device-adapter.js';
import { deviceServerEnabled } from './discocan/discocan-config.js';
import { DiscocanDeviceAdapter } from './discocan/discocan-device-adapter.js';
import {
  ermEdataMeasurementsEnabled,
  ermNotificationsEnabled,
  ermTelemetryEnabled,
} from './erm/erm-config.js';
import { ErmDeviceAdapter } from './erm/erm-device-adapter.js';

type DeviceOperation = keyof DeviceAdapter | 'measurements';

@Injectable()
export class DeviceAdapters {
  constructor(
    private readonly erm: ErmDeviceAdapter,
    private readonly discocan: DiscocanDeviceAdapter,
  ) {}

  for(type: FleetDeviceType): DeviceAdapter {
    switch (type) {
      case 'ERM':
        return this.erm;
      case 'DISCOCAN':
        return this.discocan;
    }
  }

  enabled(type: FleetDeviceType, operation: DeviceOperation): boolean {
    switch (type) {
      case 'DISCOCAN':
        return deviceServerEnabled();
      case 'ERM':
        switch (operation) {
          case 'requestFaultRead':
          case 'reports':
            return ermTelemetryEnabled();
          case 'notifications':
            return ermNotificationsEnabled();
          case 'measurements':
            return ermEdataMeasurementsEnabled();
          default:
            return process.env.FLEET_ENABLED !== 'false';
        }
    }
  }

  enabledTypes(operation: DeviceOperation): FleetDeviceType[] {
    return Object.values(FleetDeviceType).filter((type) => this.enabled(type, operation));
  }

  group<T extends { type: FleetDeviceType }>(devices: readonly T[], operation: DeviceOperation) {
    const groups = new Map<FleetDeviceType, T[]>();
    for (const device of devices) {
      const group = groups.get(device.type);
      if (group) {
        group.push(device);
      } else if (this.enabled(device.type, operation)) {
        groups.set(device.type, [device]);
      }
    }
    return groups;
  }

  async liveStates(
    devices: readonly { type: FleetDeviceType; imei: string }[],
  ): Promise<DeviceLiveSnapshot | null> {
    let snapshot: DeviceLiveSnapshot | null = null;
    for (const [type, group] of this.group(devices, 'liveStates')) {
      const next = await this.for(type).liveStates(group.map(({ imei }) => imei));
      if (snapshot === null) {
        snapshot = next;
      } else {
        snapshot.devices.push(...next.devices);
        if (next.asOf < snapshot.asOf) {
          snapshot.asOf = next.asOf;
        }
      }
    }
    return snapshot;
  }
}
