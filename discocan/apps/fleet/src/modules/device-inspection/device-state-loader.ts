import { ServiceUnavailableException } from '@nestjs/common';
import type { RequestContext } from '../../graphql/request-context.js';
import type { DeviceAdapters } from '../../integrations/device-adapters.js';
import type { DeviceResult } from '../devices/devices.service.js';

/** Fills only the requested selection, batching devices by adapter. */
export async function loadDeviceStates(
  adapters: DeviceAdapters,
  context: RequestContext,
  devices: readonly DeviceResult[],
): Promise<void> {
  await Promise.all(
    [...adapters.group(devices, 'states')].map(async ([type, group]) => {
      try {
        const states = await adapters.for(type).states(group, context);
        const byImei = new Map(states.map((state) => [state.imei, state]));
        for (const device of group) {
          device.state = byImei.get(device.imei) ?? null;
        }
      } catch (error) {
        if (!(error instanceof ServiceUnavailableException)) {
          throw error;
        }
        for (const device of group) {
          device.state = error;
        }
      }
    }),
  );
}
