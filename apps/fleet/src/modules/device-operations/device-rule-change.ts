import {
  decodeRuleData,
  decodeRuleRecord,
  editableRuleExpression,
  referencedParameterIds,
  renderRuleExpression,
} from '@holita/edata-rules';
import type { FleetDeviceRule } from '../../generated/graphql/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  karmaReadRule,
  type KarmaReadRule,
} from '../../integrations/karma/karma-device-reads.client.js';

export function configurationRules(value: Prisma.JsonValue): KarmaReadRule[] {
  if (!Array.isArray(value) || value.length > 1000) {
    throw new Error('Invalid stored device rules.');
  }
  const rules = value.map(karmaReadRule);
  if (new Set(rules.map((rule) => rule.ruleId)).size !== rules.length) {
    throw new Error('Invalid stored device rules.');
  }
  return rules;
}

export function deviceRuleResult(rule: KarmaReadRule): FleetDeviceRule {
  const record = decodeRuleRecord(rule.rawDefinition);
  let expression: string | null = null;
  let parameterIds: number[] = [];
  try {
    const parsed = decodeRuleData(record.ruleDataHex);
    parameterIds = referencedParameterIds(parsed);
    if (editableRuleExpression(parsed)) {
      expression = renderRuleExpression(parsed);
    }
  } catch {
    // Unknown device bytecode remains available unchanged as an opaque definition.
  }
  return {
    ruleId: record.ruleId,
    trueEventId: record.trueEventId,
    falseEventId: record.falseEventId,
    debounceMilliseconds: record.debounceMilliseconds,
    activateDashboard: record.activateDashboard,
    definitionHex: rule.rawDefinition,
    expression,
    parameterIds,
  };
}

export function sameRules(left: KarmaReadRule[], right: KarmaReadRule[]): boolean {
  const expected = new Map(left.map((rule) => [rule.ruleId, rule.rawDefinition]));
  return (
    left.length === right.length &&
    new Set(right.map((rule) => rule.ruleId)).size === right.length &&
    right.every((rule) => expected.get(rule.ruleId) === rule.rawDefinition)
  );
}

export function verifyRuleChange(
  baseline: KarmaReadRule[],
  actual: KarmaReadRule[],
  ruleId: number,
  rawDefinition: string,
): 'VERIFIED' | 'UNCHANGED' | 'CONFLICT' {
  if (sameRules(baseline, actual)) {
    return 'UNCHANGED';
  }
  const expected = baseline.filter((rule) => rule.ruleId !== ruleId);
  expected.push({ ruleId, rawDefinition });
  return sameRules(expected, actual) ? 'VERIFIED' : 'CONFLICT';
}
