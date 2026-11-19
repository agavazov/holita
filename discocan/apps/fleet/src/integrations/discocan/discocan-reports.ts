import { DEVICE_SERVER_ROUTES, parseDeviceReportPage } from '@discocan/device-contract';
import { requestDeviceServer } from './discocan-api.js';

export const discocanReports = {
  reports: (imei: string, after: bigint) => {
    const request = { imei, after, limit: 500 };
    const query = { after: after.toString(), limit: String(request.limit) };
    return requestDeviceServer(DEVICE_SERVER_ROUTES.reports.replace(':imei', imei), {
      query,
      parse: (value) => parseDeviceReportPage(value, request),
    });
  },
};
