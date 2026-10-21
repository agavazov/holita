import type { Prisma } from '../../generated/prisma/client.js';
import {
  karmaReadObservation,
  type KarmaReadback,
  type KarmaReadObservation,
  type KarmaReadParameter,
} from '../../integrations/karma/karma-device-reads.client.js';

export interface DeviceReadEvidence {
  coverageComplete: boolean;
  count: number;
  items: KarmaReadObservation[];
}

export class DeviceReadEvidenceError extends Error {
  constructor(readonly code: 'INVALID_SAVED_EVIDENCE' | 'EVIDENCE_LIMIT') {
    super('Device read evidence cannot be assembled.');
  }
}

export function deviceReadEvidenceJson(evidence: DeviceReadEvidence): Prisma.JsonObject {
  return {
    coverageComplete: evidence.coverageComplete,
    count: evidence.count,
    items: evidence.items.map((item) => ({
      messageId: item.messageId,
      eventTimeUtc: item.eventTimeUtc,
      rawMessage: item.rawMessage,
      configurationId: item.configurationId,
      messageNumber: item.messageNumber,
      lastMessage: item.lastMessage,
      parameters: item.parameters.map((parameter) => ({
        parameterId: parameter.parameterId,
        reportingIntervalSeconds: parameter.reportingIntervalSeconds,
        rawDefinition: parameter.rawDefinition,
      })),
    })),
  };
}

function storedItems(value: Prisma.JsonValue): KarmaReadObservation[] {
  if (Array.isArray(value) && value.length === 0) {
    return [];
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !Array.isArray(value.items)
  ) {
    throw new DeviceReadEvidenceError('INVALID_SAVED_EVIDENCE');
  }
  return value.items.map(karmaReadObservation);
}

/** Assembles normalized fragments, including fragments durably saved before a restart. */
export function mergeDeviceReadEvidence(
  stored: Prisma.JsonValue,
  fresh: KarmaReadback,
): {
  evidence: DeviceReadEvidence;
  status: 'ABSENT' | 'INCOMPLETE' | 'CONFLICT' | 'COMPLETE';
  configurationId: string | null;
  parameters: KarmaReadParameter[];
} {
  const messages = new Map<string, KarmaReadObservation>();
  let conflicting = fresh.readback.status === 'CONFLICT';
  for (const item of [...storedItems(stored), ...fresh.observations]) {
    const previous = messages.get(item.messageId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) {
      conflicting = true;
    }
    if (!previous) {
      messages.set(item.messageId, item);
    }
  }
  const items = [...messages.values()].sort((a, b) => Number(a.messageId) - Number(b.messageId));
  const evidence = { coverageComplete: fresh.coverageComplete, count: items.length, items };
  const conflict = { evidence, status: 'CONFLICT', configurationId: null, parameters: [] };
  const absent = { evidence, status: 'ABSENT', configurationId: null, parameters: [] };
  if (
    items.length > 128 ||
    items.reduce((total, item) => total + item.parameters.length, 0) > 1000
  ) {
    // Never retain truncated evidence and then treat it as a complete configuration.
    throw new DeviceReadEvidenceError('EVIDENCE_LIMIT');
  }
  if (conflicting) {
    return { ...conflict, status: 'CONFLICT' };
  }
  if (!items.length) {
    return { ...absent, status: 'ABSENT' };
  }
  const configurationId = items[0]?.configurationId ?? null;
  const parts = new Map<number, KarmaReadObservation>();
  for (const item of items) {
    if (item.configurationId !== configurationId) {
      return { ...conflict, status: 'CONFLICT' };
    }
    const previous = parts.get(item.messageNumber);
    if (
      previous &&
      (previous.lastMessage !== item.lastMessage ||
        JSON.stringify(previous.parameters) !== JSON.stringify(item.parameters))
    ) {
      return { ...conflict, status: 'CONFLICT' };
    }
    parts.set(item.messageNumber, item);
  }
  const finals = [...parts.values()].filter((item) => item.lastMessage);
  if (finals.length > 1) {
    return { ...conflict, status: 'CONFLICT' };
  }
  const finalNumber = finals[0]?.messageNumber;
  const incomplete = { evidence, status: 'INCOMPLETE', configurationId, parameters: [] };
  if (!finalNumber || !fresh.coverageComplete) {
    return { ...incomplete, status: 'INCOMPLETE' };
  }
  if ([...parts.keys()].some((number) => number > finalNumber)) {
    return { ...conflict, status: 'CONFLICT' };
  }
  const parameters: KarmaReadParameter[] = [];
  for (let number = 1; number <= finalNumber; number++) {
    const part = parts.get(number);
    if (!part) {
      return { ...incomplete, status: 'INCOMPLETE' };
    }
    parameters.push(...part.parameters);
  }
  if (new Set(parameters.map((item) => item.parameterId)).size !== parameters.length) {
    return { ...conflict, status: 'CONFLICT' };
  }
  return { evidence, status: 'COMPLETE', configurationId, parameters };
}
