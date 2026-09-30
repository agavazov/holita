import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { CoreClient } from '../core/core.client.js';
import { SpeakersRepository } from './speakers.repository.js';
import { SpeakersService } from './speakers.service.js';

describe('Speaker lookup sorting', () => {
  const list = jest.fn<SpeakersRepository['list']>();
  const requireStore = jest.fn<CoreClient['requireStore']>();
  const context = { requestId: randomUUID(), storeId: randomUUID(), storeChecks: new Map() };
  let service: SpeakersService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SpeakersService,
        { provide: SpeakersRepository, useValue: { list } },
        { provide: CoreClient, useValue: { requireStore } },
      ],
    }).compile();
    service = module.get(SpeakersService);
  });
  it('normalizes filters and uses explicit or default sorting without checking core', async () => {
    await service.list(context, {
      search: ' Lookup ',
      active: false,
      sort: { field: 'EMAIL', direction: 'ASC' },
    });
    expect(list).toHaveBeenLastCalledWith(
      context.storeId,
      0,
      20,
      { search: 'Lookup', active: false, ids: undefined },
      { field: 'EMAIL', direction: 'ASC' },
    );
    await service.list(context, {});
    expect(list).toHaveBeenLastCalledWith(
      context.storeId,
      0,
      20,
      { search: null, active: undefined, ids: undefined },
      { field: 'CREATED_AT', direction: 'DESC' },
    );
    expect(requireStore).not.toHaveBeenCalled();
  });
  it('rejects invalid context and pagination before persistence', () => {
    expect(() => service.list({ ...context, storeId: 'bad' }, {})).toThrow(BadRequestException);
    for (const args of [{ offset: -1 }, { limit: 101 }])
      expect(() => service.list(context, args)).toThrow(BadRequestException);
    expect(list).not.toHaveBeenCalled();
  });
});
