import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { CoreClient } from '../core/core.client.js';
import type { RequestContext } from '../graphql/request-context.js';
import { VenuesRepository } from './venues.repository.js';
import { VenuesService } from './venues.service.js';

describe('Venue validation', () => {
  const repository = {
    create: jest.fn<VenuesRepository['create']>(),
    update: jest.fn<VenuesRepository['update']>(),
    list: jest.fn<VenuesRepository['list']>(),
  };
  const requireStore = jest.fn<CoreClient['requireStore']>();
  const input = { name: 'Venue', city: 'Sofia', countryCode: 'BG' };
  let service: VenuesService;
  let context: RequestContext & { storeId: string };
  beforeEach(async () => {
    jest.resetAllMocks();
    context = { requestId: randomUUID(), storeId: randomUUID(), storeChecks: new Map() };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: VenuesRepository, useValue: repository },
        { provide: CoreClient, useValue: { requireStore } },
      ],
    }).compile();
    service = module.get(VenuesService);
  });
  it('rejects invalid input before checking core or writing', async () => {
    for (const invalid of [
      { name: ' ' },
      { countryCode: 'BGR' },
      { city: 'Bad\u0000city' },
      { capacity: 0 },
      { capacity: 1.5 },
    ])
      await expect(service.create(context, { ...input, ...invalid })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    await expect(service.create({ ...context, storeId: undefined }, input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(requireStore).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('does not write when core cannot establish store existence', async () => {
    requireStore.mockRejectedValue(new ServiceUnavailableException());
    await expect(service.create(context, input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('normalizes text, preserves false and clears only supplied nullable fields', async () => {
    await service.create(context, {
      ...input,
      name: '  Hall  ',
      countryCode: ' bg ',
      active: false,
    });
    expect(repository.create).toHaveBeenCalledWith(context.storeId, {
      name: 'Hall',
      city: 'Sofia',
      countryCode: 'BG',
      active: false,
      description: null,
      address: null,
      capacity: null,
    });
    const id = randomUUID();
    await service.update(context, id, { description: null, capacity: null });
    expect(repository.update).toHaveBeenCalledWith(context.storeId, id, {
      description: null,
      capacity: null,
    });
  });
  it('rejects empty updates and null required values', async () => {
    for (const invalid of [
      {},
      { name: null },
      { city: null },
      { countryCode: null },
      { active: null },
    ])
      await expect(service.update(context, randomUUID(), invalid)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    expect(repository.update).not.toHaveBeenCalled();
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('bounds pagination before persistence', () => {
    expect(() => service.list(context, { offset: -1 })).toThrow(BadRequestException);
    expect(() => service.list(context, { limit: 101 })).toThrow(BadRequestException);
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('passes normalized filters and explicit sorting without calling core', async () => {
    await service.list(context, {
      search: ' Hall ',
      active: false,
      sort: { field: 'CAPACITY', direction: 'ASC' },
    });
    expect(repository.list).toHaveBeenLastCalledWith(
      context.storeId,
      0,
      20,
      { search: 'Hall', active: false, ids: undefined },
      { field: 'CAPACITY', direction: 'ASC' },
    );
    await service.list(context, {});
    expect(repository.list).toHaveBeenLastCalledWith(
      context.storeId,
      0,
      20,
      { search: null, active: undefined, ids: undefined },
      { field: 'CREATED_AT', direction: 'DESC' },
    );
    expect(requireStore).not.toHaveBeenCalled();
  });
});
