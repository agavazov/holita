import {
  DEVICE_ACTIONS,
  DEVICE_COMMAND_DEFAULT_EXPIRY,
  DEVICE_COMMAND_MAX_EXPIRY,
  DEVICE_COMMAND_REQUEST_STATUSES,
  DEVICE_COMMAND_SORT_FIELDS,
  type DeviceAction,
  type DeviceCommandOptions,
  type DeviceCommandRequestsQuery,
  type DevicePageRequest,
} from '@discocan/device-contract';
import type {
  FleetDeviceCommandsInput,
  QueryFleetDeviceCommandRequestsArgs,
} from '../../generated/graphql/types.js';
import {
  dateTimeRange,
  enumFilter,
  enumValue,
  idList,
  integer,
  invalid,
  optionalInteger,
  pagination,
  sortDirection,
  sortField,
} from '../../validation.js';
import { deviceHistoryPage } from '../devices/device-operation-input.js';

export function commandOptions(input: {
  expiresInSeconds?: number | null;
  intent?: string | null;
}): DeviceCommandOptions {
  const intent = input.intent?.trim() || null;
  if (intent !== null && (intent.length > 200 || intent.includes('\0'))) {
    invalid('intent', 'Use an intent of at most 200 characters.');
  }
  return {
    expiresInSeconds:
      optionalInteger(input.expiresInSeconds, 'expiresInSeconds', 1, DEVICE_COMMAND_MAX_EXPIRY) ??
      DEVICE_COMMAND_DEFAULT_EXPIRY,
    intent,
  };
}

export function commandAction(value: DeviceAction): DeviceAction {
  return enumValue(value, DEVICE_ACTIONS, 'action');
}

export function commandParameters(
  action: DeviceAction,
  input: number[] | null | undefined,
): number[] {
  const parameters = input ?? [];
  if (action !== 'READ_PARAMETERS') {
    if (parameters.length) {
      invalid('parameters', 'Only READ_PARAMETERS takes parameters.', 'UNSUPPORTED_VALUE');
    }
    return parameters;
  }
  if (parameters.length < 1 || parameters.length > 20) {
    invalid('parameters', 'Choose 1 to 20 parameter numbers.');
  }
  const parsed = parameters.map((value) => integer(value, 'parameters', 1, 9999));
  if (new Set(parsed).size !== parsed.length) {
    invalid('parameters', 'Choose distinct parameter numbers.', 'DUPLICATE_VALUE');
  }
  return parsed;
}

export function commandQueueInput(
  args: QueryFleetDeviceCommandRequestsArgs,
): Omit<DeviceCommandRequestsQuery, 'tenantId' | 'branchId'> {
  const { filter, sort } = args;
  const { from, to } = dateTimeRange(filter?.createdFrom, filter?.createdTo, {
    from: 'createdFrom',
    to: 'createdTo',
  });
  const actorId = filter?.actorId?.trim();
  if (actorId !== undefined && (!actorId || actorId.length > 128 || actorId.includes('\0'))) {
    invalid('filter', 'filter.actorId: use a nonempty issuer of at most 128 characters.');
  }
  const imeis = filter?.imeis ?? undefined;
  if (
    imeis &&
    (imeis.length < 1 ||
      imeis.length > 100 ||
      new Set(imeis).size !== imeis.length ||
      imeis.some((imei) => !/^\d{15}$/.test(imei)))
  ) {
    invalid('filter', 'filter.imeis: use 1 to 100 unique 15-digit IMEIs.');
  }
  const statuses = enumFilter(filter?.statuses, DEVICE_COMMAND_REQUEST_STATUSES, 'statuses');
  const actions = enumFilter(filter?.actions, DEVICE_ACTIONS, 'actions');
  const deviceIds = idList(filter?.deviceIds, 'deviceIds');
  return {
    ...pagination(args),
    filter: {
      ...(statuses ? { statuses } : {}),
      ...(actions ? { actions } : {}),
      ...(deviceIds ? { deviceIds } : {}),
      ...(imeis ? { imeis } : {}),
      ...(actorId ? { actorId } : {}),
      ...(from ? { createdFrom: from } : {}),
      ...(to ? { createdTo: to } : {}),
    },
    sort: {
      field: sortField(sort?.field, DEVICE_COMMAND_SORT_FIELDS, 'REQUESTED_AT'),
      direction: sortDirection(sort?.direction, 'DESC'),
    },
  };
}

export function commandHistoryInput(
  input: FleetDeviceCommandsInput | null | undefined,
): DevicePageRequest {
  return deviceHistoryPage(input, 'Use a cursor returned by this Device command history.');
}
