import type { Prisma } from '../../generated/prisma/client.js';
import type { KarmaReadParameter } from '../../integrations/karma/karma-device-reads.client.js';

export interface ConfigurationParameter {
  parameterId: number;
  intervalSeconds: number;
  definitionHex: string;
}

export const DEVICE_CONFIGURATION_FRESHNESS_MS = 120_000;

export function configurationParameters(value: Prisma.JsonValue): ConfigurationParameter[] {
  if (!Array.isArray(value) || value.length > 1000) {
    throw new Error('Invalid stored device configuration.');
  }
  const parameters = value.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      typeof item.parameterId !== 'number' ||
      !Number.isInteger(item.parameterId) ||
      item.parameterId < 0 ||
      item.parameterId > 65535 ||
      typeof item.intervalSeconds !== 'number' ||
      !Number.isInteger(item.intervalSeconds) ||
      item.intervalSeconds < 0 ||
      item.intervalSeconds > 65535 ||
      typeof item.definitionHex !== 'string' ||
      !/^[0-9A-F]{44}$/.test(item.definitionHex) ||
      Number.parseInt(item.definitionHex.slice(0, 4), 16) !== item.parameterId ||
      Number.parseInt(item.definitionHex.slice(40), 16) !== item.intervalSeconds
    ) {
      throw new Error('Invalid stored device configuration.');
    }
    return {
      parameterId: item.parameterId,
      intervalSeconds: item.intervalSeconds,
      definitionHex: item.definitionHex,
    };
  });
  if (new Set(parameters.map((item) => item.parameterId)).size !== parameters.length) {
    throw new Error('Invalid stored device configuration.');
  }
  return parameters;
}

export function parameterConfiguration(parameters: KarmaReadParameter[]): ConfigurationParameter[] {
  return parameters.map((item) => ({
    parameterId: item.parameterId,
    intervalSeconds: item.reportingIntervalSeconds,
    definitionHex: item.rawDefinition,
  }));
}

export function sameConfiguration(
  left: ConfigurationParameter[],
  right: ConfigurationParameter[],
): boolean {
  const expected = new Map(left.map((item) => [item.parameterId, item.definitionHex]));
  return (
    left.length === right.length &&
    new Set(right.map((item) => item.parameterId)).size === right.length &&
    right.every((item) => expected.get(item.parameterId) === item.definitionHex)
  );
}

/** Monitor 9.56 Get_Parameter_From_Row defaults, not a CAN decoder. */
export function monitorDefinition(parameterId: number, intervalSeconds: number): string {
  const defaults = '030D000000000000000100010000000000000000003C';
  return (
    parameterId.toString(16).padStart(4, '0').toUpperCase() +
    defaults.slice(4, 40) +
    intervalSeconds.toString(16).padStart(4, '0').toUpperCase()
  );
}

export function changedDefinition(baseline: string, intervalSeconds: number): string {
  return baseline.slice(0, 40) + intervalSeconds.toString(16).padStart(4, '0').toUpperCase();
}

/** Whole-set verification preserves unknown definitions and detects unrelated changes. */
export function verifyParameterChange(
  baseline: ConfigurationParameter[],
  actual: ConfigurationParameter[],
  parameterId: number,
  definitionHex: string,
  addition: boolean,
): 'VERIFIED' | 'UNCHANGED' | 'CONFLICT' {
  if (sameConfiguration(baseline, actual)) {
    return 'UNCHANGED';
  }
  const expected = new Map(baseline.map((item) => [item.parameterId, item.definitionHex]));
  expected.set(parameterId, definitionHex);
  if (
    expected.size !== actual.length ||
    new Set(actual.map((item) => item.parameterId)).size !== actual.length
  ) {
    return 'CONFLICT';
  }
  // The predefined-parameter firmware may normalize its constructor's 1/1 to 0/0.
  const normalizedAddition = definitionHex.slice(0, 16) + '00000000' + definitionHex.slice(24);
  return actual.every((item) =>
    item.parameterId === parameterId
      ? item.definitionHex === definitionHex ||
        (addition && item.definitionHex === normalizedAddition)
      : item.definitionHex === expected.get(item.parameterId),
  )
    ? 'VERIFIED'
    : 'CONFLICT';
}

export function evidenceWatermark(value: Prisma.JsonValue): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.items)) {
    return undefined;
  }
  let maximum = 0;
  for (const item of value.items) {
    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      typeof item.messageId === 'string' &&
      /^[1-9][0-9]*$/.test(item.messageId) &&
      Number.isSafeInteger(Number(item.messageId))
    ) {
      maximum = Math.max(maximum, Number(item.messageId));
    }
  }
  return maximum > 0 ? String(maximum) : undefined;
}
