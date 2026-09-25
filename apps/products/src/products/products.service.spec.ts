import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { CoreClient } from '../core/core.client.js';
import type { RequestContext } from '../graphql/request-context.js';
import { ProductsRepository } from './products.repository.js';
import { ProductsService } from './products.service.js';

describe('Products service validation', () => {
  const repository = {
    create: jest.fn<ProductsRepository['create']>(),
    update: jest.fn<ProductsRepository['update']>(),
    list: jest.fn<ProductsRepository['list']>(),
  };
  const requireStore = jest.fn<CoreClient['requireStore']>();
  let service: ProductsService;
  let context: RequestContext & { storeId: string };
  beforeEach(async () => {
    jest.resetAllMocks();
    context = { requestId: randomUUID(), storeId: randomUUID(), storeChecks: new Map() };
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: repository },
        { provide: CoreClient, useValue: { requireStore } },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('rejects invalid input before checking core or writing', async () => {
    await expect(service.create(context, { name: ' ', sku: 'VALID' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.create({ ...context, storeId: undefined }, { name: 'Valid', sku: 'VALID' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(requireStore).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not persist when core cannot establish store existence', async () => {
    requireStore.mockRejectedValue(new ServiceUnavailableException('Core unavailable'));
    await expect(service.create(context, { name: 'Valid', sku: 'VALID' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects empty and explicit null updates without a core dependency', async () => {
    await expect(service.update(context, randomUUID(), {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update(context, randomUUID(), { name: null })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.update).not.toHaveBeenCalled();
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('bounds pagination before repository access', () => {
    expect(() => service.list(context, { limit: 101 })).toThrow(BadRequestException);
    expect(() => service.list(context, { offset: -1 })).toThrow(BadRequestException);
    expect(repository.list).not.toHaveBeenCalled();
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('normalizes optional search before repository access', async () => {
    await service.list(context, {
      offset: 2,
      limit: 10,
      search: '  Note-1  ',
      status: 'ACTIVE',
    });
    expect(repository.list).toHaveBeenLastCalledWith(context.storeId, 2, 10, 'Note-1', 'ACTIVE');
    await service.list(context, { search: '   ', status: null });
    expect(repository.list).toHaveBeenLastCalledWith(context.storeId, 0, 20, undefined, undefined);
    await service.list(context, {});
    expect(repository.list).toHaveBeenLastCalledWith(context.storeId, 0, 20, undefined, undefined);
    expect(requireStore).not.toHaveBeenCalled();
  });

  it('rejects invalid status before repository access', () => {
    expect(() => {
      Reflect.apply(service.list.bind(service), undefined, [context, { status: 'ARCHIVED' }]);
    }).toThrow(BadRequestException);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('rejects NUL search before repository access', () => {
    expect(() => service.list(context, { search: 'bad\u0000search' })).toThrow(BadRequestException);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('accepts Unicode character limits consistently with the form and PostgreSQL', async () => {
    const input = { name: '😀'.repeat(200), sku: '🛍'.repeat(100) };
    await service.create(context, input);
    expect(repository.create).toHaveBeenCalledWith(context.storeId, { ...input, status: 'DRAFT' });
    await service.update(context, randomUUID(), input);
    expect(repository.update).toHaveBeenCalledWith(context.storeId, expect.any(String), input);
    await expect(
      service.create(context, { ...input, name: input.name + 'a' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(context, { ...input, sku: input.sku + 'a' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects NUL characters before checking core or writing to PostgreSQL', async () => {
    for (const input of [
      { name: 'Bad\u0000name', sku: 'SKU' },
      { name: 'Name', sku: 'Bad\u0000sku' },
    ]) {
      await expect(service.create(context, input)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.update(context, randomUUID(), input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(requireStore).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });
});
