import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { CoreClient } from '../core/core.client.js';
import { VehiclesRepository } from './vehicles.repository.js';
import { VehiclesService } from './vehicles.service.js';

describe('Vehicles validation and scope', () => {
  const list = jest.fn<VehiclesRepository['list']>();
  const create = jest.fn<VehiclesRepository['create']>();
  const update = jest.fn<VehiclesRepository['update']>();
  const requireStore = jest.fn<CoreClient['requireStore']>();
  const context = {
    requestId: randomUUID(),
    storeId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    authorization: undefined,
    storeChecks: new Map(),
  };
  let service: VehiclesService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: VehiclesRepository, useValue: { list, create, update } },
        { provide: CoreClient, useValue: { requireStore } },
      ],
    }).compile();
    service = module.get(VehiclesService);
  });
  it('normalizes filters and uses default sorting without checking core', async () => {
    await service.list(context, {
      search: ' CA ',
      sort: { field: 'LICENSE_PLATE', direction: 'ASC' },
    });
    expect(list).toHaveBeenLastCalledWith(
      context.tenantId,
      context.storeId,
      0,
      20,
      { search: 'CA', ids: undefined },
      { field: 'LICENSE_PLATE', direction: 'ASC' },
    );
    await service.list(context, {});
    expect(list).toHaveBeenLastCalledWith(
      context.tenantId,
      context.storeId,
      0,
      20,
      { search: null, ids: undefined },
      { field: 'CREATED_AT', direction: 'DESC' },
    );
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('checks the store only for creation, trims fields and clears notes on update', async () => {
    await service.create(context, {
      licensePlate: ' CA1234AB ',
      notes: ' First line\nSecond line ',
    });
    expect(requireStore).toHaveBeenCalledWith(context.storeId, context);
    expect(create).toHaveBeenCalledWith(context.tenantId, context.storeId, {
      licensePlate: 'CA1234AB',
      notes: 'First line\nSecond line',
    });
    requireStore.mockClear();
    const id = randomUUID();
    await service.update(context, id, { notes: null });
    expect(update).toHaveBeenCalledWith(context.tenantId, context.storeId, id, { notes: null });
    expect(requireStore).not.toHaveBeenCalled();
  });
  it.each(['', ' ', 'A'.repeat(33), 'A\u0000'])(
    'rejects invalid plates without core calls or writes: %s',
    async (licensePlate) => {
      await expect(service.create(context, { licensePlate })).rejects.toThrow(BadRequestException);
      expect(create).not.toHaveBeenCalled();
      expect(requireStore).not.toHaveBeenCalled();
    },
  );
  it('rejects oversized notes and empty updates', async () => {
    await expect(
      service.create(context, { licensePlate: 'CA1234AB', notes: '😀'.repeat(2001) }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.update(context, randomUUID(), {})).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects invalid context and paging before persistence', () => {
    expect(() => service.list({ ...context, storeId: 'bad' }, {})).toThrow(BadRequestException);
    for (const args of [{ offset: -1 }, { limit: 101 }])
      expect(() => service.list(context, args)).toThrow(BadRequestException);
    expect(list).not.toHaveBeenCalled();
  });
});
