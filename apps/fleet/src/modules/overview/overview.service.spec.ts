import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { FleetClock } from '../../clock/fleet-clock.js';
import { OverviewRepository } from './overview.repository.js';
import { OverviewService } from './overview.service.js';

describe('Fleet overview scope and daily distance', () => {
  const dailyDistance = jest.fn<OverviewRepository['dailyDistance']>();
  const overview = jest.fn<OverviewRepository['overview']>();
  const findVehicle = jest.fn<OverviewRepository['findVehicle']>();
  const context = {
    requestId: randomUUID(),
    tenantId: randomUUID(),
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map<string, Promise<void>>(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  const repository = { dailyDistance, overview, findVehicle };
  let service: OverviewService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OverviewService,
        { provide: OverviewRepository, useValue: repository },
        { provide: FleetClock, useValue: { now: () => new Date('2026-10-17T22:30:00Z') } },
      ],
    }).compile();
    service = module.get(OverviewService);
  });
  it('passes the clock instant for scoped business-date calculation and validates day and vehicle bounds', async () => {
    await service.overview(context);
    expect(overview).toHaveBeenCalledWith(scope, new Date('2026-10-17T22:30:00Z'));
    dailyDistance.mockResolvedValue({ dataAsOf: null, points: [] });
    await expect(service.dailyDistance(context, {})).resolves.toEqual({
      dataAsOf: null,
      points: [],
    });
    expect(dailyDistance).toHaveBeenCalledWith(scope, 14, undefined);
    for (const days of [0, 94, 1.5]) {
      await expect(service.dailyDistance(context, { days })).rejects.toThrow(BadRequestException);
    }
    await expect(service.dailyDistance(context, { vehicleId: 'invalid' })).rejects.toThrow(
      BadRequestException,
    );
    const vehicleId = randomUUID();
    findVehicle.mockResolvedValue(null);
    await expect(service.dailyDistance(context, { vehicleId, days: 2 })).rejects.toThrow(
      NotFoundException,
    );
    findVehicle.mockResolvedValue({ id: vehicleId });
    await service.dailyDistance(context, { vehicleId, days: 93 });
    expect(findVehicle).toHaveBeenLastCalledWith(scope, vehicleId);
    expect(dailyDistance).toHaveBeenLastCalledWith(scope, 93, vehicleId);
  });
});
