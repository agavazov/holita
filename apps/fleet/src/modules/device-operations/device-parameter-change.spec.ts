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
  it('uses the documented Monitor constructor for arbitrary predefined IDs and zero interval', () => {
    expect(monitorDefinition(781, 60)).toBe('030D000000000000000100010000000000000000003C');
    expect(monitorDefinition(651, 0)).toBe('028B0000000000000001000100000000000000000000');
  });

  it('preserves every unknown definition byte except its two interval bytes', () => {
    const changed = changedDefinition(unknown.definitionHex, 65000);
    expect(changed).toBe(unknown.definitionHex.slice(0, 40) + 'FDE8');
    expect(
      verifyParameterChange(
        [unknown, known],
        [{ ...unknown, intervalSeconds: 65000, definitionHex: changed }, known],
        65000,
        changed,
        false,
      ),
    ).toBe('VERIFIED');
    expect(verifyParameterChange([unknown, known], [unknown, known], 65000, changed, false)).toBe(
      'UNCHANGED',
    );
  });

  it('accepts only the documented new-predefined multiplier/divisor normalization', () => {
    const normalized = { ...known, definitionHex: '030D000000000000000000000000000000000000003C' };
    expect(
      verifyParameterChange([unknown], [unknown, normalized], 781, known.definitionHex, true),
    ).toBe('VERIFIED');
    expect(
      verifyParameterChange([unknown], [unknown, normalized], 781, known.definitionHex, false),
    ).toBe('CONFLICT');
    expect(verifyParameterChange([unknown], [normalized], 781, known.definitionHex, true)).toBe(
      'CONFLICT',
    );
    expect(
      verifyParameterChange(
        [unknown],
        [unknown, { ...known, definitionHex: known.definitionHex.slice(0, 40) + '003D' }],
        781,
        known.definitionHex,
        true,
      ),
    ).toBe('CONFLICT');
  });

  it('rejects an unrelated changed definition, an extra ID, and malformed saved snapshots', () => {
    expect(
      verifyParameterChange(
        [unknown],
        [{ ...unknown, definitionHex: unknown.definitionHex.replace('ABCD', 'FFFF') }, known],
        781,
        known.definitionHex,
        true,
      ),
    ).toBe('CONFLICT');
    expect(
      verifyParameterChange(
        [unknown],
        [unknown, known, { ...known, parameterId: 2 }],
        781,
        known.definitionHex,
        true,
      ),
    ).toBe('CONFLICT');
    expect(() => configurationParameters([{ ...unknown, parameterId: 1 }])).toThrow(
      'Invalid stored',
    );
    expect(() => configurationParameters([unknown, unknown])).toThrow('Invalid stored');
  });
});
