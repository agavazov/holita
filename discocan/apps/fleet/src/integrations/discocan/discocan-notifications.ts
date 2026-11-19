import {
  DEVICE_SERVER_ROUTES,
  parseDeviceNotificationPage,
  type DeviceNotificationsRequest,
} from '@discocan/device-contract';
import { requestDeviceServer } from './discocan-api.js';

export const discocanNotifications = {
  notifications: (request: DeviceNotificationsRequest) => {
    const { imei, since, limit, after, ...scope } = request;
    const query = {
      ...scope,
      since: since.toISOString(),
      limit: String(limit),
      ...(after === null ? {} : { after }),
    };
    return requestDeviceServer(DEVICE_SERVER_ROUTES.notifications.replace(':imei', imei), {
      query,
      parse: (value) => parseDeviceNotificationPage(value, request),
    });
  },
};
