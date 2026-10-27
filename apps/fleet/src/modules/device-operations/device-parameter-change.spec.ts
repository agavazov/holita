import { describe, expect, it } from '@jest/globals';
import {
  decodeRuleData,
  decodeRuleRecord,
  encodeRuleData,
  encodeRuleRecord,
  parseRuleExpression,
  referencedParameterIds,
  renderRuleExpression,
  type RuleExpression,
} from '@holita/edata-rules';
import { deviceRuleResult, verifyRuleChange } from './device-rule-change.js';
import {
  changedDefinition,
  configurationParameters,
  monitorDefinition,
  verifyParameterChange,
} from './device-parameter-change.js';

const unknown = {
  parameterId: 65000,
  intervalSeconds: 37,
  definitionHex: 'FDE8ABCDEF1234561234567890ABCDEF123456780025',
};
const known = { parameterId: 781, intervalSeconds: 60, definitionHex: monitorDefinition(781, 60) };

describe('Single reporting-definition changes', () => {
  it('parameter changes and compiled rule records preserve the exact device contract', () => {
    const changed = changedDefinition(unknown.definitionHex, 65000);
    const definitions: [string, string, string][] = [
      [
        'Monitor constructor with an interval',
        monitorDefinition(781, 60),
        '030D000000000000000100010000000000000000003C',
      ],
      [
        'Monitor constructor with a zero interval',
        monitorDefinition(651, 0),
        '028B0000000000000001000100000000000000000000',
      ],
      [
        'unknown definition with a new interval',
        changed,
        unknown.definitionHex.slice(0, 40) + 'FDE8',
      ],
    ];
    for (const [row, actual, expected] of definitions) {
      expect({ row, value: actual }).toEqual({ row, value: expected });
    }
    // The documented new-predefined multiplier/divisor normalization.
    const normalized = { ...known, definitionHex: '030D000000000000000000000000000000000000003C' };
    const verifications: [string, Parameters<typeof verifyParameterChange>, string][] = [
      [
        'only the interval bytes changed',
        [
          [unknown, known],
          [{ ...unknown, intervalSeconds: 65000, definitionHex: changed }, known],
          65000,
          changed,
          false,
        ],
        'VERIFIED',
      ],
      [
        'nothing changed yet',
        [[unknown, known], [unknown, known], 65000, changed, false],
        'UNCHANGED',
      ],
      [
        'normalized new predefined definition',
        [[unknown], [unknown, normalized], 781, known.definitionHex, true],
        'VERIFIED',
      ],
      [
        'normalized definition outside an addition',
        [[unknown], [unknown, normalized], 781, known.definitionHex, false],
        'CONFLICT',
      ],
      [
        'baseline parameter missing',
        [[unknown], [normalized], 781, known.definitionHex, true],
        'CONFLICT',
      ],
      [
        'different interval bytes',
        [
          [unknown],
          [unknown, { ...known, definitionHex: known.definitionHex.slice(0, 40) + '003D' }],
          781,
          known.definitionHex,
          true,
        ],
        'CONFLICT',
      ],
      [
        'unrelated definition changed',
        [
          [unknown],
          [{ ...unknown, definitionHex: unknown.definitionHex.replace('ABCD', 'FFFF') }, known],
          781,
          known.definitionHex,
          true,
        ],
        'CONFLICT',
      ],
      [
        'extra parameter ID',
        [[unknown], [unknown, known, { ...known, parameterId: 2 }], 781, known.definitionHex, true],
        'CONFLICT',
      ],
    ];
    for (const [row, args, expected] of verifications) {
      expect({ row, value: verifyParameterChange(...args) }).toEqual({ row, value: expected });
    }
    expect(() => configurationParameters([{ ...unknown, parameterId: 1 }])).toThrow(
      'Invalid stored',
    );
    expect(() => configurationParameters([unknown, unknown])).toThrow('Invalid stored');

    const ruleVectors = [
      ['[718] > 10', '07021502CE0F0A'],
      ['[718] > [748]', '07021502CE1502EC'],
      ['[747] = 123', '05021502EB0F7B'],
      ['([1592] != 12) * 133', '030206021506380F0C0F85'],
      ['$TimeOf([718] = 1)', '1605021502CE0F01'],
      ['$Count([718] = 1)', '1705021502CE0F01'],
      ['$Sum([718])', '181502CE'],
      ['-65535', '13FFFF'],
      ['2147483647', '117FFFFFFF'],
    ];
    for (const [source, binary] of ruleVectors) {
      if (!source || !binary) {
        throw new Error('Missing rule vector');
      }
      expect(encodeRuleData(parseRuleExpression(source))).toBe(binary);
      expect(
        encodeRuleData(parseRuleExpression(renderRuleExpression(decodeRuleData(binary)))),
      ).toBe(binary);
    }
    for (const source of ['-65536', '1.5', '1e3', '[1] + [2] * 3']) {
      expect(() => parseRuleExpression(source)).toThrow();
    }
    expect(referencedParameterIds(parseRuleExpression('([718] > [748]) and ([718] < 30)'))).toEqual(
      [718, 748],
    );
    let maximum: RuleExpression = { kind: 'integer', value: 0 };
    for (let depth = 0; depth < 126; depth++) {
      maximum = { kind: 'function', function: 'Sum', child: maximum };
    }
    const maximumData = encodeRuleData(maximum);
    expect(maximumData.length).toBe(256);
    const record = {
      ruleId: 1,
      trueEventId: 0x5341,
      falseEventId: 0x5342,
      debounceMilliseconds: 1,
      activateDashboard: true,
      ruleDataHex: maximumData,
    };
    expect(decodeRuleRecord(encodeRuleRecord(record))).toEqual(record);
    expect(() => encodeRuleData({ kind: 'function', function: 'Sum', child: maximum })).toThrow();
    const originalRule = { ruleId: 1, rawDefinition: '00010000000000010707021502CE0F0A' };
    const opaqueRule = { ruleId: 2, rawDefinition: '000200000000800101FF' };
    const updatedRule = {
      ...originalRule,
      rawDefinition: originalRule.rawDefinition.slice(0, -2) + '0B',
    };
    expect(deviceRuleResult(opaqueRule)).toMatchObject({
      expression: null,
      activateDashboard: true,
      definitionHex: opaqueRule.rawDefinition,
    });
    const ruleVerification: [Parameters<typeof verifyRuleChange>, string][] = [
      [
        [[originalRule, opaqueRule], [updatedRule, opaqueRule], 1, updatedRule.rawDefinition],
        'VERIFIED',
      ],
      [
        [[originalRule, opaqueRule], [originalRule, opaqueRule], 1, updatedRule.rawDefinition],
        'UNCHANGED',
      ],
      [[[originalRule, opaqueRule], [updatedRule], 1, updatedRule.rawDefinition], 'CONFLICT'],
      [
        [
          [originalRule, opaqueRule],
          [
            updatedRule,
            { ...opaqueRule, rawDefinition: opaqueRule.rawDefinition.slice(0, -2) + 'FE' },
          ],
          1,
          updatedRule.rawDefinition,
        ],
        'CONFLICT',
      ],
    ];
    for (const [args, expected] of ruleVerification) {
      expect(verifyRuleChange(...args)).toBe(expected);
    }
  });
});
