import { decodeRuleRecord } from '@holita/edata-rules';
import { ServiceUnavailableException } from '@nestjs/common';

interface ConfigurationRule {
  ruleId: number;
  rawDefinition: string;
}

export interface RuleObservation {
  messageId: string;
  eventTimeUtc: string;
  rawMessage: string;
  configurationId: string;
  messageNumber: number;
  lastMessage: boolean;
  rules: ConfigurationRule[];
}

export interface RuleReadback {
  status: 'ABSENT' | 'INCOMPLETE' | 'CONFLICT' | 'COMPLETE';
  configurationId: string | null;
  rules: ConfigurationRule[];
}

function unavailable(): never {
  throw new ServiceUnavailableException('Karma rule observations are unavailable');
}

export function ruleObservation(
  messageId: string,
  eventTimeUtc: string,
  rawMessage: string,
): RuleObservation | null {
  if (!/^19,0,402,/.test(rawMessage)) {
    return null;
  }
  const fields = /^19,0,402,0,([01]),([1-9]\d{0,3}),(0|[1-9]\d{0,4}),08([a-f\d]*)$/i.exec(
    rawMessage,
  );
  if (!fields || rawMessage.length > 8192) {
    unavailable();
  }
  const configurationId = fields[3];
  const definitions = fields[4];
  const messageNumber = Number(fields[2]);
  if (
    configurationId === undefined ||
    definitions === undefined ||
    Number(configurationId) > 65535 ||
    messageNumber > 1000 ||
    definitions.length % 2 !== 0
  ) {
    unavailable();
  }
  const rules: ConfigurationRule[] = [];
  for (let offset = 0; offset < definitions.length;) {
    if (definitions.length - offset < 18) {
      unavailable();
    }
    const byteLength = Number.parseInt(definitions.slice(offset + 16, offset + 18), 16);
    const end = offset + (9 + byteLength) * 2;
    if (end > definitions.length) {
      unavailable();
    }
    const rawDefinition = definitions.slice(offset, end).toUpperCase();
    try {
      // Unknown expression bytecode is part of the recoverable device baseline.
      const rule = decodeRuleRecord(rawDefinition);
      rules.push({ ruleId: rule.ruleId, rawDefinition });
    } catch {
      unavailable();
    }
    offset = end;
  }
  return {
    messageId,
    eventTimeUtc,
    rawMessage,
    configurationId,
    messageNumber,
    lastMessage: fields[1] === '1',
    rules,
  };
}

export function ruleReadback(
  observations: RuleObservation[],
  coverageComplete: boolean,
): RuleReadback {
  if (!observations.length) {
    return { status: 'ABSENT', configurationId: null, rules: [] };
  }
  const configurationId = observations[0]?.configurationId ?? null;
  const incomplete: RuleReadback = { status: 'INCOMPLETE', configurationId, rules: [] };
  const conflict: RuleReadback = { status: 'CONFLICT', configurationId: null, rules: [] };
  const parts = new Map<number, RuleObservation>();
  for (const observation of observations) {
    if (observation.configurationId !== configurationId) {
      return conflict;
    }
    const previous = parts.get(observation.messageNumber);
    if (
      previous &&
      (previous.lastMessage !== observation.lastMessage ||
        JSON.stringify(previous.rules) !== JSON.stringify(observation.rules))
    ) {
      return conflict;
    }
    parts.set(observation.messageNumber, observation);
  }
  const last = [...parts.values()].filter((part) => part.lastMessage);
  if (last.length > 1) {
    return conflict;
  }
  const finalNumber = last[0]?.messageNumber;
  if (finalNumber === undefined || !coverageComplete) {
    return incomplete;
  }
  if ([...parts.keys()].some((number) => number > finalNumber)) {
    return conflict;
  }
  const rules: ConfigurationRule[] = [];
  for (let number = 1; number <= finalNumber; number++) {
    const part = parts.get(number);
    if (!part) {
      return incomplete;
    }
    rules.push(...part.rules);
  }
  if (rules.length > 1000 || new Set(rules.map((rule) => rule.ruleId)).size !== rules.length) {
    return conflict;
  }
  return {
    status: 'COMPLETE',
    configurationId,
    rules: rules.sort((left, right) => left.ruleId - right.ruleId),
  };
}
