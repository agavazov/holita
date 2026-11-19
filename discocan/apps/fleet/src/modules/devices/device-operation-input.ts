import {
  DEVICE_PAGE_SIZES,
  isDevicePageCursor,
  type DevicePageRequest,
} from '@discocan/device-contract';
import { invalid, optionalInteger, uuid } from '../../validation.js';

export function deviceBatchIds(deviceIds: string[]): string[] {
  if (deviceIds.length < 1 || deviceIds.length > 100) {
    invalid('deviceIds', 'Choose 1 to 100 Devices.');
  }
  const ids = deviceIds.map((id) => uuid(id, 'deviceIds'));
  if (new Set(ids).size !== ids.length) {
    invalid('deviceIds', 'Choose distinct Devices.', 'DUPLICATE_VALUE');
  }
  return ids;
}

export function deviceHistoryPage(
  input:
    { pageSize?: number | null; offset?: number | null; cursor?: string | null } | null | undefined,
  cursorError = 'Use a cursor returned by a device history page.',
): DevicePageRequest {
  const pageSize = input?.pageSize ?? 50;
  const cursor = input?.cursor ?? null;
  const offset = optionalInteger(input?.offset, 'offset', 0, 2_147_483_647);
  if (!DEVICE_PAGE_SIZES.some((size) => size === pageSize)) {
    invalid('pageSize', 'Use a page size of 25, 50 or 100.');
  }
  if (cursor !== null && !isDevicePageCursor(cursor)) {
    invalid('cursor', cursorError, 'INVALID_FORMAT');
  }
  if (offset !== null && cursor !== null) {
    invalid('offset', 'Omit the offset when using a cursor.');
  }
  return { pageSize, offset, cursor };
}
