import { describe, expect, it } from '@jest/globals';
import { deviceStatus } from './device-state.js';

describe('Device reporting status', () => {
  const asOf = new Date('2026-10-20T10:00:00.000Z');
  const cutoff = new Date(asOf.getTime() - 48 * 3_600_000);
  it('uses the exact 48-hour boundary and reports assigned devices without data as offline', () => {
    expect(deviceStatus('vehicle', cutoff, asOf)).toBe('ONLINE');
    expect(deviceStatus('vehicle', new Date(cutoff.getTime() - 1), asOf)).toBe('OFFLINE');
    expect(deviceStatus('vehicle', null, asOf)).toBe('OFFLINE');
    expect(deviceStatus('vehicle', asOf, null)).toBe('OFFLINE');
  });
  it('keeps stock in stock even if an old pair had reported', () => {
    expect(deviceStatus(null, asOf, asOf)).toBe('IN_STOCK');
    expect(deviceStatus(null, null, null)).toBe('IN_STOCK');
  });

  it('applies the configured reporting window without changing stock semantics', () => {
    const configuredCutoff = new Date(asOf.getTime() - 3_600_000);
    expect(deviceStatus('vehicle', configuredCutoff, asOf, 1)).toBe('ONLINE');
    expect(deviceStatus('vehicle', new Date(configuredCutoff.getTime() - 1), asOf, 1)).toBe(
      'OFFLINE',
    );
    expect(deviceStatus(null, configuredCutoff, asOf, 1)).toBe('IN_STOCK');
  });
});
