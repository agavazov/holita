import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { CoreClient } from '../core/core.client.js';
import { TagsRepository } from './tags.repository.js';
import { TagsService } from './tags.service.js';

describe('Tag lookup sorting', () => {
  const list = jest.fn<TagsRepository['list']>();
  const requireStore = jest.fn<CoreClient['requireStore']>();
  const context = { requestId: randomUUID(), storeId: randomUUID(), storeChecks: new Map() };
  let service: TagsService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: TagsRepository, useValue: { list } },
        { provide: CoreClient, useValue: { requireStore } },
      ],
    }).compile();
    service = module.get(TagsService);
  });
  it('normalizes filters and uses explicit or default sorting without checking core', async () => {
    await service.list(context, {
      search: ' Lookup ',
      active: false,
      sort: { field: 'COLOR', direction: 'ASC' },
    });
    expect(list).toHaveBeenLastCalledWith(
      context.storeId,
      0,
      20,
      { search: 'Lookup', active: false, ids: undefined },
      { field: 'COLOR', direction: 'ASC' },
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
