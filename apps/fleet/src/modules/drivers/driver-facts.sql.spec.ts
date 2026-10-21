import { describe, expect, it } from '@jest/globals';
import { driverFactsSql } from './driver-facts.sql.js';

const scope = {
  tenantId: '01000000-0000-4000-8000-000000000001',
  branchId: '10000000-0000-4000-8000-000000000001',
};
const window = { start: new Date('2026-09-18T07:00:00Z'), end: new Date('2026-10-18T07:00:00Z') };

describe('Driver statistics query work', () => {
  it('restricts trips before aggregation using bound requested IDs and both scope keys', () => {
    const ids = ['50000000-0000-4000-8000-000000000001'];
    const query = driverFactsSql('statistics_test', scope, window, ids);
    const aggregation = query.text.slice(0, query.text.indexOf('GROUP BY'));
    expect(aggregation).toMatch(/t\."driverId" = ANY\(\$\d+::uuid\[\]\)/);
    expect(aggregation).toContain('t."tenantId" =');
    expect(aggregation).toContain('t."branchId" =');
    expect(query.text).not.toContain(ids[0]);
    expect(query.values).toEqual(expect.arrayContaining([ids, scope.tenantId, scope.branchId]));
  });

  it('keeps full-Branch list and summary aggregation when no ID constraint is requested', () => {
    const query = driverFactsSql('statistics_test', scope);
    expect(query.text).not.toContain('t."driverId" = ANY');
    expect(query.text).toContain('GROUP BY t."driverId"');
  });

  it('treats an explicit empty selection as no drivers rather than all drivers', () => {
    const query = driverFactsSql('statistics_test', scope, window, []);
    expect(query.text).toMatch(/t\."driverId" = ANY\(\$\d+::uuid\[\]\)/);
    expect(query.values).toEqual(expect.arrayContaining([[]]));
  });
});
