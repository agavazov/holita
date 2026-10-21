import { BadRequestException } from '@nestjs/common';

function invalid(): never {
  throw new BadRequestException('Invalid device configuration request');
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function input(value: unknown, keys: string[]): Record<string, unknown> {
  if (!object(value)) {
    invalid();
  }
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    invalid();
  }
  return value;
}

function carId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  ) {
    invalid();
  }
  return value;
}

function expectedDeviceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(value)) {
    invalid();
  }
  return value;
}

function utc(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    invalid();
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    invalid();
  }
  return value;
}

export function configurationTarget(value: unknown) {
  const body = input(value, ['carId']);
  return { carId: carId(body['carId']) };
}

export function configurationRequest(value: unknown) {
  const body = input(value, ['carId', 'expectedDeviceId']);
  return {
    carId: carId(body['carId']),
    expectedDeviceId: expectedDeviceId(body['expectedDeviceId']),
  };
}

export function configurationParameterRequest(value: unknown) {
  const body = input(value, [
    'carId',
    'expectedDeviceId',
    'parameterId',
    'reportingIntervalSeconds',
    'rawDefinition',
  ]);
  const parameterId = body['parameterId'];
  const reportingIntervalSeconds = body['reportingIntervalSeconds'];
  const rawDefinition = body['rawDefinition'];
  if (
    typeof parameterId !== 'number' ||
    !Number.isInteger(parameterId) ||
    parameterId < 0 ||
    parameterId > 65535 ||
    typeof reportingIntervalSeconds !== 'number' ||
    !Number.isInteger(reportingIntervalSeconds) ||
    reportingIntervalSeconds < 0 ||
    reportingIntervalSeconds > 65000 ||
    typeof rawDefinition !== 'string' ||
    !/^[a-f\d]{44}$/i.test(rawDefinition) ||
    Number.parseInt(rawDefinition.slice(0, 4), 16) !== parameterId ||
    Number.parseInt(rawDefinition.slice(40), 16) !== reportingIntervalSeconds
  ) {
    invalid();
  }
  return {
    carId: carId(body['carId']),
    expectedDeviceId: expectedDeviceId(body['expectedDeviceId']),
    parameterId,
    reportingIntervalSeconds,
    rawDefinition: rawDefinition.toUpperCase(),
  };
}

export function configurationWindow(value: unknown) {
  const body = input(value, ['carId', 'expectedDeviceId', 'fromUtc', 'toUtc', 'afterMessageId']);
  const fromUtc = utc(body['fromUtc']);
  const toUtc = utc(body['toUtc']);
  if (fromUtc > toUtc || new Date(toUtc).getTime() - new Date(fromUtc).getTime() > 86400000) {
    invalid();
  }
  return {
    carId: carId(body['carId']),
    expectedDeviceId: expectedDeviceId(body['expectedDeviceId']),
    fromUtc,
    toUtc,
    afterMessageId:
      body['afterMessageId'] === undefined ? undefined : carId(body['afterMessageId']),
  };
}
