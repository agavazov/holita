import { describe, expect, it } from '@jest/globals';
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
  it('definition changes alter only the interval bytes', () => {
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
  });
});
