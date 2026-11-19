import {
  DEVICE_SERVER_ROUTES,
  parseDeviceLiveSnapshot,
  parseDeviceProblemPage,
  type DeviceProblemRequest,
} from '@discocan/device-contract';
import { requestDeviceServer } from './discocan-api.js';

export const discocanStatus = {
  liveStates: async (imeis: readonly string[]) => {
    const devices = [];
    let asOf: Date | undefined;
    const unique = [...new Set(imeis)];
    for (let offset = 0; offset < unique.length; offset += 500) {
      const body = { imeis: unique.slice(offset, offset + 500) };
      const snapshot = await requestDeviceServer(DEVICE_SERVER_ROUTES.live, {
        body,
        parse: (value) => parseDeviceLiveSnapshot(value, body),
      });
      devices.push(...snapshot.devices);
      if (asOf === undefined || snapshot.asOf < asOf) {
        asOf = snapshot.asOf;
      }
    }
    return { asOf: asOf ?? new Date(), devices };
  },

  problems: (request: DeviceProblemRequest) => {
    return requestDeviceServer(DEVICE_SERVER_ROUTES.problems, {
      body: request,
      parse: (value) => parseDeviceProblemPage(value, request),
    });
  },
};
