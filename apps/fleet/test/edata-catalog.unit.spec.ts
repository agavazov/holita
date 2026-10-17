import { describe, expect, it } from '@jest/globals';
import { parseCatalog } from '../src/modules/edata-catalog/catalog-file.js';
import { catalogDocument, catalogFixture } from './edata-catalog.fixture.js';

describe('eData catalog file validation', () => {
  it('preserves category duplicates, raw conflicts and ordered unresolved members', () => {
    const value = catalogFixture();
    expect(value.parameters.map((p) => p.parameterId)).toEqual([1, 1, 1]);
    expect(value.memberships.map((m) => m.parameterId)).toEqual([1, 999, 1]);
    expect(value.parameters[2]?.details).toMatchObject({
      sourceHex: '2',
      calculatedHex: '1',
      issues: ['decimal_hex_mismatch'],
    });
  });
  it.each([
    'schema',
    'coverage',
    'reference',
    'duplicate',
    'membership',
    'mapping',
    'issues',
    'source',
  ])('rejects invalid %s before connecting to the database', (kind) => {
    const value = catalogDocument();
    if (kind === 'schema') value.schemaVersion = 2;
    if (kind === 'coverage') value.coverage.parameters = 999;
    if (kind === 'reference' && value.profiles[0]) value.profiles[0].setId = 999;
    if (kind === 'duplicate' && value.parameters[0]) value.parameters.push(value.parameters[0]);
    if (kind === 'membership' && value.sets[0]) value.sets[0].parameterIds.push(2);
    if (kind === 'mapping') value.mappings.pop();
    if (kind === 'issues') value.coverage.issues.decimal_hex_mismatch = 0;
    if (kind === 'source' && value.parameters[0]) value.parameters[0].sourceKey = 'missing';
    expect(() => parseCatalog(Buffer.from(JSON.stringify(value)))).toThrow();
  });
  it('rejects truncated JSON and incomplete extraction', () => {
    expect(() => parseCatalog(Buffer.from('{'))).toThrow();
    const value = catalogDocument();
    value.coverage.complete = false;
    expect(() => parseCatalog(Buffer.from(JSON.stringify(value)))).toThrow('incomplete');
  });
});
