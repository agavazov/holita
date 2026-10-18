import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { CoreClient } from '../../integrations/core/core.client.js';
import { type VehicleGroupRow, VehicleGroupsRepository } from './vehicle-groups.repository.js';
import { VehicleGroupsService } from './vehicle-groups.service.js';

async function fieldErrors(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    const response = error.getResponse();
    return typeof response === 'object' && 'fieldErrors' in response
      ? response.fieldErrors
      : undefined;
  }
  throw new Error('Expected BAD_USER_INPUT');
}

describe('Vehicle groups validation and scope', () => {
  const list = jest.fn<VehicleGroupsRepository['list']>();
  const nameTaken = jest.fn<VehicleGroupsRepository['nameTaken']>();
  const create = jest.fn<VehicleGroupsRepository['create']>();
  const update = jest.fn<VehicleGroupsRepository['update']>();
  const remove = jest.fn<VehicleGroupsRepository['delete']>();
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  const context = {
    requestId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  };
  const scope = { tenantId: context.tenantId, branchId: context.branchId };
  const row: VehicleGroupRow = {
    id: randomUUID(),
    tenantId: context.tenantId,
    branchId: context.branchId,
    name: 'Long haul',
    description: null,
    colorToken: 'C1',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    _count: { vehicles: 3 },
  };
  let service: VehicleGroupsService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        VehicleGroupsService,
        {
          provide: VehicleGroupsRepository,
          useValue: { list, nameTaken, create, update, delete: remove },
        },
        { provide: CoreClient, useValue: { requireBranch } },
      ],
    }).compile();
    service = module.get(VehicleGroupsService);
    list.mockResolvedValue({ items: [row], total: 1, ungroupedVehicleCount: 4 });
    nameTaken.mockResolvedValue(false);
    create.mockResolvedValue(row);
    update.mockResolvedValue(row);
  });

  it('lists by name ascending with counts and the ungrouped vehicle count', async () => {
    expect(await service.list(context, { search: ' haul ' })).toEqual({
      items: [
        {
          id: row.id,
          branchId: row.branchId,
          name: 'Long haul',
          description: null,
          colorToken: 'C1',
          vehicleCount: 3,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
      ungroupedVehicleCount: 4,
    });
    expect(list).toHaveBeenCalledWith(
      scope,
      { offset: 0, limit: 20 },
      { tokens: ['haul'], ids: undefined },
      { field: 'NAME', direction: 'ASC' },
    );
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('creates with the default colour after the name check and one Core call', async () => {
    await service.create(context, { name: ' Long haul ', description: ' ' });
    expect(nameTaken).toHaveBeenCalledWith(scope, 'Long haul', null);
    expect(requireBranch).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(scope, {
      name: 'Long haul',
      description: null,
      colorToken: 'C1',
    });
  });

  it.each([
    [{ name: '' }, 'name'],
    [{ name: 'N'.repeat(65) }, 'name'],
    [{ name: 'Group', description: 'D'.repeat(501) }, 'description'],
  ])('rejects %j on %s', async (input, path) => {
    expect(await fieldErrors(service.create(context, input))).toMatchObject([{ path }]);
    expect(create).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('rejects duplicate names, null required fields and empty updates', async () => {
    nameTaken.mockResolvedValue(true);
    expect(await fieldErrors(service.create(context, { name: 'Long haul' }))).toEqual([
      { path: 'name', message: 'A vehicle group with this name already exists in this branch.' },
    ]);
    const id = randomUUID();
    expect(await fieldErrors(service.update(context, id, { name: 'Long haul' }))).toMatchObject([
      { path: 'name' },
    ]);
    expect(nameTaken).toHaveBeenLastCalledWith(scope, 'Long haul', id);
    for (const input of [{ name: null }, { colorToken: null }])
      expect(await fieldErrors(service.update(context, id, input))).toHaveLength(1);
    await expect(service.update(context, id, {})).rejects.toThrow(BadRequestException);
    await service.update(context, id, { colorToken: 'C5', description: null });
    expect(update).toHaveBeenCalledWith(scope, id, { colorToken: 'C5', description: null });
    expect(requireBranch).not.toHaveBeenCalled();
  });

  it('protects deletion of groups that still contain vehicles', async () => {
    remove.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK', { code: 'P2003', clientVersion: '7' }),
    );
    await expect(service.delete(context, randomUUID())).rejects.toThrow(
      new ConflictException('Vehicle group still contains vehicles; move them first.'),
    );
  });
});
