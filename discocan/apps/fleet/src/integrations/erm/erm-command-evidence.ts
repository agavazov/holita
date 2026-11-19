import { parseDeviceCommand } from '@discocan/device-contract';
import { recordOf, text, textOrNull } from '../../database/sql.js';
import type { FleetDeviceCommand } from '../../generated/graphql/types.js';
import { ermAcknowledgement, ermAcknowledgementFields } from './erm-inspection.js';

export const ermCommandFields = `
  id imei: unitId connectionId status sentAt answeredAt resultCode responseText
  reference command fields responseHex
  ${ermAcknowledgementFields}
`;

export function ermCommand(value: unknown) {
  const row = recordOf(value);
  const parsed = parseDeviceCommand(row);
  return {
    ...parsed,
    acknowledgement: ermAcknowledgement(parsed.acknowledgement, row.acknowledgement),
    erm: {
      reference: text(row, 'reference'),
      command: text(row, 'command'),
      fields: stringList(row.fields),
      responseHex: textOrNull(row, 'responseHex'),
    },
  } satisfies FleetDeviceCommand;
}

export function stringList(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item: unknown): item is string => typeof item === 'string')
  ) {
    throw new TypeError('Invalid command fields');
  }
  return value;
}
