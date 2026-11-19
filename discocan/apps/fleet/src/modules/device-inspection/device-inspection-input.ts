import {
  DEVICE_EVENT_CATEGORIES,
  DEVICE_EVENT_SORT_FIELDS,
  DEVICE_SORT_DIRECTIONS,
  SEVERITIES,
  type DeviceEventsRequest,
  type DeviceMessagesRequest,
} from '@discocan/device-contract';
import type {
  FleetDeviceEventsInput,
  FleetDeviceMessagesInput,
} from '../../generated/graphql/types.js';
import { enumValue, sortDirection, sortField } from '../../validation.js';
import { deviceHistoryPage } from '../devices/device-operation-input.js';

export function deviceEventsInput(
  input: FleetDeviceEventsInput | null | undefined,
): DeviceEventsRequest {
  return {
    ...deviceHistoryPage(input),
    categories:
      input?.categories?.map((value) => enumValue(value, DEVICE_EVENT_CATEGORIES, 'categories')) ??
      null,
    severities:
      input?.severities?.map((value) => enumValue(value, SEVERITIES, 'severities')) ?? null,
    sort: {
      field: sortField(input?.sort?.field, DEVICE_EVENT_SORT_FIELDS, 'TIME'),
      direction: sortDirection(input?.sort?.direction, 'DESC'),
    },
  };
}

export function deviceMessagesInput(
  input: FleetDeviceMessagesInput | null | undefined,
): DeviceMessagesRequest {
  return {
    ...deviceHistoryPage(input),
    direction: enumValue(input?.direction ?? 'DESC', DEVICE_SORT_DIRECTIONS, 'direction'),
  };
}
