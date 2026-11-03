import { BadRequestException } from '@nestjs/common';
import type { ParsedFrame } from '../../starlink/index.js';

export interface DeviceCommand {
  command: '03' | '04' | '05' | '45' | '46';
  fields: string[];
}

function parameterNumber(value: string): boolean {
  return /^\d{1,4}$/.test(value) && Number(value) > 0;
}

function routingParameter(value: string): boolean {
  return parameterNumber(value) && Number(value) >= 49 && Number(value) <= 54;
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
  if (
    (command === '04' || command === '46') &&
    fields.length >= 2 &&
    fields.length % 2 === 0 &&
    (command === '46' || fields.length === 2) &&
    fields.every((field, index) =>
      index % 2 === 0 ? routingParameter(field) : routingValue(field),
    )
  ) {
    return { command, fields };
  }
  throw new BadRequestException(
    'Allowed commands: 03/45 parameter reads, 05 location, and 04/46 for parameters 0049–0054',
  );
}

export function commandParameterNumbers(input: DeviceCommand): string[] {
  if (input.command !== '03' && input.command !== '45') {
    return [];
  }
  return input.fields.map((field) => String(Number(field)));
}

export function matchesParameterResponse(input: DeviceCommand, frame: ParsedFrame): boolean {
  if (frame.command !== input.command) {
    return false;
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
