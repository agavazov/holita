import {
  DEVICE_SERVER_ROUTES,
  parseDeviceEventPage,
  parseDeviceMessagePage,
  parseDeviceStateSnapshot,
  type DeviceEventsRequest,
  type DeviceMessagesRequest,
  type DevicePageRequest,
} from '@discocan/device-contract';
import { type InspectionDevice } from '../device-adapter.js';
import { requestDeviceServer } from './discocan-api.js';

function pageQuery({ pageSize, offset, cursor }: DevicePageRequest) {
  return {
    pageSize: String(pageSize),
    ...(offset === null ? {} : { offset: String(offset) }),
    ...(cursor === null ? {} : { cursor }),
  };
}

export const discocanInspection = {
  states: async (devices: readonly InspectionDevice[]) => {
    const states = [];
    for (let start = 0; start < devices.length; start += 500) {
      const body = { imeis: devices.slice(start, start + 500).map(({ imei }) => imei) };
      const snapshot = await requestDeviceServer(DEVICE_SERVER_ROUTES.state, {
        body,
        parse: (value) => parseDeviceStateSnapshot(value, body),
      });
      states.push(...snapshot.devices);
    }
    return states;
  },

  events: ({ imei }: InspectionDevice, input: DeviceEventsRequest) => {
    const query = {
      ...pageQuery(input),
      sortField: input.sort.field,
      sortDirection: input.sort.direction,
      ...(input.categories === null ? {} : { categories: input.categories.join(',') }),
      ...(input.severities === null ? {} : { severities: input.severities.join(',') }),
    };
    return requestDeviceServer(DEVICE_SERVER_ROUTES.events.replace(':imei', imei), {
      query,
      parse: (value) => parseDeviceEventPage(value, imei, input),
    });
  },

  messages: ({ imei }: InspectionDevice, input: DeviceMessagesRequest) => {
    const query = { ...pageQuery(input), direction: input.direction };
    return requestDeviceServer(DEVICE_SERVER_ROUTES.messages.replace(':imei', imei), {
      query,
      parse: (value) => parseDeviceMessagePage(value, imei, input),
    });
  },
};
