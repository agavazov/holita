import type { AdminVehicleProfileQuery } from '../../../../generated/graphql/operations';
import { vehicleDistance } from './vehicle-profile-mapping';

describe('Vehicle profile daily distance mapping', () => {
  it('uses short localized calendar labels without changing dates, zero or canonical distances', () => {
    const distance: AdminVehicleProfileQuery['fleetDailyDistance'] = {
      dataAsOf: '2026-10-07T07:00:00.000Z',
      points: [
        { date: '2026-10-06', distanceKm: 0 },
        { date: '2026-10-07', distanceKm: 160.9344 },
      ],
    };
    expect(vehicleDistance(distance, 'en')).toEqual([
      { key: '2026-10-06', label: 'Oct 6', value: 0, valueText: '0 km' },
      { key: '2026-10-07', label: 'Oct 7', value: 160.9344, valueText: '161 km' },
    ]);
    expect(vehicleDistance(distance, 'bg')).toEqual([
      { key: '2026-10-06', label: '6.10', value: 0, valueText: '0 km' },
      { key: '2026-10-07', label: '7.10', value: 160.9344, valueText: '161 km' },
    ]);
    expect(distance.points).toEqual([
      { date: '2026-10-06', distanceKm: 0 },
      { date: '2026-10-07', distanceKm: 160.9344 },
    ]);
  });

  it('keeps an absent telemetry clock and empty series absent', () => {
    const distance: AdminVehicleProfileQuery['fleetDailyDistance'] = {
      dataAsOf: null,
      points: [],
    };
    expect(vehicleDistance(distance, 'en')).toEqual([]);
    expect(distance.dataAsOf).toBeNull();
  });
});
