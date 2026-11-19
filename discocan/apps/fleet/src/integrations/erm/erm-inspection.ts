import {
  parseDeviceEvent,
  parseDeviceMessage,
  parseDeviceState,
  type DeviceAcknowledgement,
  type DeviceEvent,
  type DeviceEventsRequest,
  type DeviceMessagesRequest,
  type DevicePage,
} from '@discocan/device-contract';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  boolean,
  date,
  integer,
  oneOf,
  recordOf,
  rowsOf,
  text,
  textOrNull,
} from '../../database/sql.js';
import type { FleetErmDeviceEvent } from '../../generated/graphql/types.js';
import { invalid } from '../../validation.js';
import type {
  InspectionCaller,
  InspectionDevice,
  InspectionEvent,
  InspectionMessage,
  InspectionState,
} from '../device-adapter.js';
import { requestErmGraphql } from './erm-api.js';

const eventFields = `
  id messageId: frameId imei: unitId code: eventId recordedAt: eventTime positionAt: positionTime
  latitude longitude speedKph: speedKmh headingDeg: heading odometerKm: odometer
  engineOn ignition: ignitionOn externalVoltage: mainVoltage backupBatteryVoltage: backupVoltage
  category severity nameEn: name(language: EN) nameBg: name(language: BG) fields edata
`;
export const ermAcknowledgementFields =
  'acknowledgement { commandId commandRequestId resultCode receivedAt commandReference replyReference }';
export const ermMessageFields = `
  id connectionId imei: unitId direction receivedAt partial displayText payloadHex: rawHex
  command reference checksum
  ${ermAcknowledgementFields}
`;
const pageFields = 'total offset limit cursor nextCursor hasMore';

const stateQuery = `query FleetReadDeviceState($devices: [_Any!]!) {
  _entities(representations: $devices) {
    ... on FleetDevice {
      ermState {
        imei: unitId connected: online connectedSince lastReportAt: lastFrameAt mode
        recovery { id startedAt finishedAt outcome reason primaryHost primaryPort }
        latestPosition: lastPosition { ${eventFields} }
        latestEvent { ${eventFields} }
        latestAlarm { ${eventFields} }
        alarmsLast24h
        externalVoltage: mainVoltage { value observedAt }
        backupBatteryVoltage: backupVoltage { value observedAt }
        signalQuality { value observedAt }
        firmwareVersion { value observedAt }
        measurements: edataMeasurements { parameterId parameterType valueSize valueHex name unit observedAt }
        health {
          lastReportAgeSeconds: lastFrameAgeSeconds expectedIntervalSeconds overdue
          gapsLast24h { from to durationSeconds expectedIntervalSeconds }
          networkChangesLast24h latestNetworkChange { at networkType operatorCode }
          lastCloseReason lastClosedAt upstreamClosesLast24h karmaRoutingWritesLast24h
          latestKarmaRoutingWrite { ${ermMessageFields} }
        }
      }
    }
  }
}`;

const eventsQuery = `query FleetReadDeviceEvents($devices: [_Any!]!, $input: ErmDeviceEventsInput!) {
  _entities(representations: $devices) {
    ... on FleetDevice { ermEvents(input: $input) { ${pageFields} items { ${eventFields} } } }
  }
}`;
const messagesQuery = `query FleetReadDeviceMessages($devices: [_Any!]!, $input: ErmDevicePageInput!) {
  _entities(representations: $devices) {
    ... on FleetDevice { ermFrames(input: $input) { ${pageFields} items { ${ermMessageFields} } } }
  }
}`;

function eventInput(value: unknown) {
  if (value === null) {
    return null;
  }
  const row = recordOf(value);
  return {
    ...row,
    category: row.category === 'EDATA' ? 'DIAGNOSTIC' : row.category,
    names: { EN: row.nameEn, BG: row.nameBg },
  };
}

function eventDetails(row: Record<string, unknown>): FleetErmDeviceEvent {
  return { fields: row.fields, edata: row.edata };
}

function stateEvent(parsed: DeviceEvent | null, raw: unknown): InspectionEvent | null {
  return parsed === null ? null : { ...parsed, erm: eventDetails(recordOf(raw)) };
}

export function ermAcknowledgement(parsed: DeviceAcknowledgement | null, value: unknown) {
  if (parsed === null) {
    return null;
  }
  const ack = recordOf(value);
  return {
    ...parsed,
    erm: {
      commandReference: text(ack, 'commandReference'),
      replyReference: text(ack, 'replyReference'),
    },
  };
}

export function ermMessage(row: Record<string, unknown>): InspectionMessage {
  const parsed = parseDeviceMessage({
    ...row,
    direction: row.direction === 'DISCOCAN' ? 'SERVER' : row.direction,
  });
  return {
    ...parsed,
    acknowledgement: ermAcknowledgement(parsed.acknowledgement, row.acknowledgement),
    erm: {
      command: textOrNull(row, 'command'),
      reference: textOrNull(row, 'reference'),
      checksum: oneOf(row, 'checksum', ['OK', 'MISMATCH', 'ABSENT']),
    },
  };
}

function state(row: Record<string, unknown>): InspectionState {
  const health = recordOf(row.health);
  const recovery = row.recovery === null ? null : recordOf(row.recovery);
  const parsed = parseDeviceState({
    ...row,
    latestPosition: eventInput(row.latestPosition),
    latestEvent: eventInput(row.latestEvent),
    latestAlarm: eventInput(row.latestAlarm),
    measurements: rowsOf(row.measurements, (measurement) => ({
      ...measurement,
      freezeFrame: false,
    })),
  });
  return {
    ...parsed,
    latestPosition: stateEvent(parsed.latestPosition, row.latestPosition),
    latestEvent: stateEvent(parsed.latestEvent, row.latestEvent),
    latestAlarm: stateEvent(parsed.latestAlarm, row.latestAlarm),
    erm: {
      mode: row.mode === null ? null : oneOf(row, 'mode', ['PRIMARY', 'MIRROR'] as const),
      recovery: recovery && {
        id: text(recovery, 'id'),
        startedAt: date(recovery, 'startedAt'),
        finishedAt: date(recovery, 'finishedAt'),
        outcome: oneOf(recovery, 'outcome', ['ALREADY_DISCOCAN', 'NEEDS_OPERATOR']),
        reason: text(recovery, 'reason'),
        primaryHost: textOrNull(recovery, 'primaryHost'),
        primaryPort: textOrNull(recovery, 'primaryPort'),
      },
      upstreamClosesLast24h: integer(health, 'upstreamClosesLast24h'),
      karmaRoutingWritesLast24h: integer(health, 'karmaRoutingWritesLast24h'),
      latestKarmaRoutingWrite:
        health.latestKarmaRoutingWrite === null
          ? null
          : ermMessage(recordOf(health.latestKarmaRoutingWrite)),
    },
  };
}

function page<T>(value: unknown, parse: (row: Record<string, unknown>) => T): DevicePage<T> {
  const row = recordOf(value);
  return {
    items: rowsOf(row.items, parse),
    total: integer(row, 'total'),
    offset: integer(row, 'offset'),
    limit: integer(row, 'limit'),
    cursor: textOrNull(row, 'cursor'),
    nextCursor: textOrNull(row, 'nextCursor'),
    hasMore: boolean(row, 'hasMore'),
  };
}

@Injectable()
export class ErmInspection {
  states(devices: readonly InspectionDevice[], caller: InspectionCaller) {
    return this.entities(stateQuery, devices, caller, {}, (entities) =>
      entities.flatMap((entity, index) => {
        if (entity === null || entity.ermState === null) {
          return [];
        }
        const result = state(recordOf(entity.ermState));
        if (result.imei !== devices[index]?.imei) {
          throw new Error('Unexpected ERM state scope');
        }
        return [result];
      }),
    );
  }

  events(device: InspectionDevice, input: DeviceEventsRequest, caller: InspectionCaller) {
    const field = { TIME: 'TIME', CODE: 'EVENT_TYPE', SEVERITY: 'STATUS' }[input.sort.field];
    return this.entities(
      eventsQuery,
      [device],
      caller,
      {
        ...input,
        categories:
          input.categories?.map((category) => (category === 'DIAGNOSTIC' ? 'EDATA' : category)) ??
          null,
        sort: { field, direction: input.sort.direction },
      },
      ([entity]) => {
        if (!entity) {
          throw new NotFoundException('Device not found');
        }
        return page(entity.ermEvents, (row): InspectionEvent => {
          const event = parseDeviceEvent(eventInput(row));
          if (event.imei !== device.imei) {
            throw new Error('Unexpected ERM event scope');
          }
          return { ...event, erm: eventDetails(row) };
        });
      },
    );
  }

  messages(device: InspectionDevice, input: DeviceMessagesRequest, caller: InspectionCaller) {
    return this.entities(messagesQuery, [device], caller, input, ([entity]) => {
      if (!entity) {
        throw new NotFoundException('Device not found');
      }
      return page(entity.ermFrames, (row) => {
        const result = ermMessage(row);
        if (result.imei !== null && result.imei !== device.imei) {
          throw new Error('Unexpected ERM message scope');
        }
        return result;
      });
    });
  }

  private async entities<T>(
    query: string,
    devices: readonly InspectionDevice[],
    { authorization, branchId }: InspectionCaller,
    input: object,
    parse: (entities: (Record<string, unknown> | null)[]) => T,
  ): Promise<T> {
    if (!authorization || !branchId) {
      throw new ServiceUnavailableException('ERM inspection needs a signed-in Branch session');
    }
    const representations = devices.map(({ id, imei }) => ({
      __typename: 'FleetDevice',
      id,
      imei,
    }));
    try {
      const body = await requestErmGraphql(
        query,
        { devices: representations, input },
        { authorization, 'x-branch-id': branchId },
      );
      if (body.errors !== undefined) {
        const codes = rowsOf(body.errors, (error) => recordOf(error.extensions).code);
        if ('cursor' in input && input.cursor !== null && codes.includes('BAD_USER_INPUT')) {
          invalid(
            'cursor',
            'Use a cursor issued for this device history and query.',
            'INVALID_FORMAT',
          );
        }
        throw new Error('ERM inspection query failed');
      }
      const entities = recordOf(body.data)._entities;
      if (!Array.isArray(entities) || entities.length !== devices.length) {
        throw new Error('Unexpected ERM entities');
      }
      return parse(entities.map((value: unknown) => (value === null ? null : recordOf(value))));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new ServiceUnavailableException('ERM inspection data is unavailable');
    }
  }
}
