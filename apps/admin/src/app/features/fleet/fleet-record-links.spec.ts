import { driverReturnId, fleetRecordLinks } from './fleet-record-links';

describe('Fleet record navigation scope', () => {
  it('captures language and Branch without carrying another resource filter into links', () => {
    const links = fleetRecordLinks('bg', 'branch-a');
    expect(links.vehicle('vehicle-a')).toEqual({
      commands: ['/', 'bg', 'branch-a', 'fleet', 'vehicles', 'vehicle-a', 'overview'],
    });
    expect(links.driver('driver-a')).toEqual({
      commands: ['/', 'bg', 'branch-a', 'fleet', 'drivers', 'driver-a'],
    });
  });
  it('accepts only a Driver UUID as a bounded return target', () => {
    const id = '60000000-0000-4000-8000-000000000001';
    expect(driverReturnId(id)).toBe(id);
    for (const value of [
      null,
      '',
      'invalid',
      'https://example.test',
      '../drivers/other',
      id + '/edit',
    ]) {
      expect(driverReturnId(value)).toBeNull();
    }
  });
});
