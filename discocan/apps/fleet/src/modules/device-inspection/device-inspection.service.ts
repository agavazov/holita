import { emptyDevicePage } from '@discocan/device-contract';
import { Injectable } from '@nestjs/common';
import type {
  FleetDeviceEventsInput,
  FleetDeviceMessagesInput,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { DeviceAdapters } from '../../integrations/device-adapters.js';
import { DevicesService } from '../devices/devices.service.js';
import { deviceEventsInput, deviceMessagesInput } from './device-inspection-input.js';

@Injectable()
export class DeviceInspectionService {
  constructor(
    private readonly devices: DevicesService,
    private readonly adapters: DeviceAdapters,
  ) {}

  async events(
    context: RequestContext,
    id: string,
    input: FleetDeviceEventsInput | null | undefined,
  ) {
    const [, device] = await this.devices.scopedDevice(context, id);
    const request = deviceEventsInput(input);
    return this.adapters.enabled(device.type, 'events')
      ? this.adapters.for(device.type).events(device, request, context)
      : emptyDevicePage(request);
  }

  async messages(
    context: RequestContext,
    id: string,
    input: FleetDeviceMessagesInput | null | undefined,
  ) {
    const [, device] = await this.devices.scopedDevice(context, id);
    const request = deviceMessagesInput(input);
    return this.adapters.enabled(device.type, 'messages')
      ? this.adapters.for(device.type).messages(device, request, context)
      : emptyDevicePage(request);
  }
}
