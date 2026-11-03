import { BadRequestException } from '@nestjs/common';
import type { ParsedFrame } from '../../starlink/index.js';

export interface DeviceCommand {
  command: string;
  fields: string[];
}

// Read commands without fields, and read commands with one number (a rule, zone, sensor, input or
// device), as documented in the StarLink protocol archive. "56" without a flag only lists accessories.
const plainReads = new Set(['07', '12', '16', '19', '49', '56', '60', '61']);
const numberedReads = new Map([
  ['08', /^\d{2}$/],
  ['10', /^\d{1,3}$/],
  ['23', /^\d$/],
  ['27', /^\d$/],
  ['36', /^\d{1,3}$/],
  ['43', /^\d$/],
  ['51', /^\d$/],
  ['53', /^\d{1,2}$/],
]);
// Lock codes, the SIM PIN, the authentication secret, operator/SIM locks and the Simple SMS password.
const protectedParameters = new Set([59, 60, 61, 187, 524, 525, 593]);

function parameterNumber(value: string): boolean {
  return /^\d{1,4}$/.test(value) && Number(value) > 0;
}

function routingParameter(value: string): boolean {
  return parameterNumber(value) && Number(value) >= 49 && Number(value) <= 54;
}

function writableParameter(value: string): boolean {
  return (
    parameterNumber(value) && !routingParameter(value) && !protectedParameters.has(Number(value))
  );
}

function routingValue(value: string): boolean {
  const text =
    value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
  return /^[\x20-\x21\x23-\x2b\x2d-\x7e]*$/.test(text);
}

export function validateCommand(body: unknown): DeviceCommand {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('command' in body) ||
    !('fields' in body) ||
    !Array.isArray(body.fields) ||
    !body.fields.every((field: unknown): field is string => typeof field === 'string')
  ) {
    throw new BadRequestException('Expected a command and an array of string fields');
  }

  const { command, fields } = body;
  if (command === '03' && fields.length === 1 && fields.every(parameterNumber)) {
    return { command, fields };
  }
  if (command === '45' && fields.length > 0 && fields.every(parameterNumber)) {
    return { command, fields };
  }
  if (
    command === '05' &&
    (fields.length === 0 || (fields.length === 1 && /^\d{1,4}$/.test(fields[0] ?? '')))
  ) {
    return { command, fields };
  }
  if (typeof command === 'string') {
    const numbered = numberedReads.get(command);
    if (
      (plainReads.has(command) && fields.length === 0) ||
      (numbered !== undefined && fields.length === 1 && numbered.test(fields[0] ?? ''))
    ) {
      return { command, fields };
    }
  }
  if (command === '48' && fields.length === 1 && /^[\x20-\x7e]{1,200}$/.test(fields[0] ?? '')) {
    return { command, fields };
  }
  // Routing parameters are written only together; other writes never touch routing or secrets.
  const parameters = fields.filter((_, index) => index % 2 === 0);
  if (
    (command === '04' || command === '46') &&
    fields.length >= 2 &&
    fields.length % 2 === 0 &&
    (command === '46' || fields.length === 2) &&
    (parameters.every(routingParameter) || parameters.every(writableParameter)) &&
    fields.every((field, index) => index % 2 === 0 || routingValue(field))
  ) {
    return { command, fields };
  }
  throw new BadRequestException(
    'Allowed commands: 03/45/48 and other documented reads, 05 location, and 04/46 writes that ' +
      'either set only 0049–0054 or avoid them and the protected parameters',
  );
}

export function commandParameterNumbers(input: DeviceCommand): string[] {
  if (input.command !== '03' && input.command !== '45') {
    return [];
  }
  return input.fields.map((field) => String(Number(field)));
}

export function matchesResponse(input: DeviceCommand, frame: ParsedFrame): boolean {
  if (frame.command !== input.command) {
    return false;
  }
  if (input.command !== '03' && input.command !== '45') {
    return frame.origin === 'SLU';
  }
  if (input.command === '03') {
    const parameter = frame.fields[0]?.toString('latin1') ?? '';
    return (
      frame.fields.length >= 2 &&
      parameterNumber(parameter) &&
      Number(parameter) === Number(input.fields[0])
    );
  }
  if (input.command !== '45' || frame.fields.length !== input.fields.length * 2) {
    return false;
  }
  const received = frame.fields
    .filter((_, index) => index % 2 === 0)
    .map((field) => field.toString('latin1'));
  return (
    received.every(parameterNumber) &&
    commandParameterNumbers(input).every((number) =>
      received.some((value) => Number(value) === Number(number)),
    )
  );
}
