import type { Prisma } from '../../generated/prisma/client.js';
import {
  karmaRuleObservation,
  type KarmaRulesReadback,
  type KarmaRuleObservation,
  type KarmaReadRule,
  type KarmaReadTerminalResponse,
} from '../../integrations/karma/karma-device-reads.client.js';
import { DeviceReadEvidenceError, storedTerminalResponse } from './device-read-evidence.js';

export interface DeviceRuleEvidence {
  coverageComplete: boolean;
  count: number;
  items: KarmaRuleObservation[];
  terminalResponse?: KarmaReadTerminalResponse;
}

export function deviceRuleEvidenceJson(evidence: DeviceRuleEvidence): Prisma.JsonObject {
  return {
    coverageComplete: evidence.coverageComplete,
    count: evidence.count,
    ...(evidence.terminalResponse ? { terminalResponse: { ...evidence.terminalResponse } } : {}),
    items: evidence.items.map((item) => ({
      messageId: item.messageId,
      eventTimeUtc: item.eventTimeUtc,
      rawMessage: item.rawMessage,
      configurationId: item.configurationId,
      messageNumber: item.messageNumber,
      lastMessage: item.lastMessage,
      rules: item.rules.map((rule) => ({
        ruleId: rule.ruleId,
        rawDefinition: rule.rawDefinition,
      })),
    })),
  };
}

function storedItems(value: Prisma.JsonValue): KarmaRuleObservation[] {
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
  return value.items.map(karmaRuleObservation);
}

/** Assembles normalized fragments, including fragments durably saved before a restart. */
export function mergeDeviceRuleEvidence(
  stored: Prisma.JsonValue,
  fresh: KarmaRulesReadback,
): {
  evidence: DeviceRuleEvidence;
  status: 'ABSENT' | 'INCOMPLETE' | 'CONFLICT' | 'COMPLETE' | 'NO_CONFIGURATION';
  configurationId: string | null;
  rules: KarmaReadRule[];
} {
  const messages = new Map<string, KarmaRuleObservation>();
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
  const terminalResponse = fresh.terminalResponse ?? storedTerminalResponse(stored);
  const evidence = {
    coverageComplete: fresh.coverageComplete,
    count: items.length,
    items,
    ...(terminalResponse ? { terminalResponse } : {}),
  };
  const noConfiguration = terminalResponse && fresh.coverageComplete;
  const conflict = { evidence, status: 'CONFLICT', configurationId: null, rules: [] };
  const absent = { evidence, status: 'ABSENT', configurationId: null, rules: [] };
  if (items.length > 128 || items.reduce((total, item) => total + item.rules.length, 0) > 1000) {
    // Never retain truncated evidence and then treat it as a complete configuration.
    throw new DeviceReadEvidenceError('EVIDENCE_LIMIT');
  }
  if (conflicting) {
    return { ...conflict, status: 'CONFLICT' };
  }
  if (!items.length) {
    return { ...absent, status: noConfiguration ? 'NO_CONFIGURATION' : 'ABSENT' };
  }
  const configurationId = items[0]?.configurationId ?? null;
  const parts = new Map<number, KarmaRuleObservation>();
  for (const item of items) {
    if (item.configurationId !== configurationId) {
      return { ...conflict, status: 'CONFLICT' };
    }
    const previous = parts.get(item.messageNumber);
    if (
      previous &&
      (previous.lastMessage !== item.lastMessage ||
        JSON.stringify(previous.rules) !== JSON.stringify(item.rules))
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
  const incomplete = { evidence, status: 'INCOMPLETE', configurationId, rules: [] };
  if (!finalNumber || !fresh.coverageComplete) {
    return { ...incomplete, status: noConfiguration ? 'NO_CONFIGURATION' : 'INCOMPLETE' };
  }
  if ([...parts.keys()].some((number) => number > finalNumber)) {
    return { ...conflict, status: 'CONFLICT' };
  }
  const rules: KarmaReadRule[] = [];
  for (let number = 1; number <= finalNumber; number++) {
    const part = parts.get(number);
    if (!part) {
      return { ...incomplete, status: noConfiguration ? 'NO_CONFIGURATION' : 'INCOMPLETE' };
    }
    rules.push(...part.rules);
  }
  if (new Set(rules.map((item) => item.ruleId)).size !== rules.length) {
    return { ...conflict, status: 'CONFLICT' };
  }
  return {
    evidence,
    status: 'COMPLETE',
    configurationId,
    rules: rules.sort((left, right) => left.ruleId - right.ruleId),
  };
}
