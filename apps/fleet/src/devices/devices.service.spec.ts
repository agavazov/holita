import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { CoreClient } from '../core/core.client.js';
import { Prisma } from '../generated/prisma/client.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesService } from './devices.service.js';

describe('Devices validation and scope', () => {
  const list = jest.fn<DevicesRepository['list']>();
  const create = jest.fn<DevicesRepository['create']>();
  const update = jest.fn<DevicesRepository['update']>();
  const findVehicle = jest.fn<DevicesRepository['findVehicle']>();
  const requireBranch = jest.fn<CoreClient['requireBranch']>();
  const context = {
    requestId: randomUUID(),
    tenantId: '01000000-0000-4000-8000-000000000001',
    branchId: randomUUID(),
    authorization: undefined,
    branchChecks: new Map(),
  };
  const vehicleId = randomUUID();
  let service: DevicesService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: DevicesRepository, useValue: { list, create, update, findVehicle } },
        { provide: CoreClient, useValue: { requireBranch } },
      ],
    }).compile();
    service = module.get(DevicesService);
    jest.resetAllMocks();
    findVehicle.mockResolvedValue({
      id: vehicleId,
      tenantId: context.tenantId,
      branchId: context.branchId,
      licensePlate: 'CA1234AB',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  it('normalizes filters and validates paging without checking Core', async () => {
    await service.list(context, { search: ' 001 ', sort: { field: 'IMEI', direction: 'ASC' } });
    expect(list).toHaveBeenCalledWith(
      context.tenantId,
      context.branchId,
      0,
      20,
      { search: '001', ids: undefined },
      { field: 'IMEI', direction: 'ASC' },
    );
    expect(() => service.list(context, { limit: 101 })).toThrow(BadRequestException);
    expect(() => service.list({ ...context, branchId: 'bad' }, {})).toThrow(BadRequestException);
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('preserves leading zeros and checks the same-branch vehicle before creation', async () => {
    await service.create(context, { imei: ' 001234567890123 ', vehicleId });
    expect(findVehicle).toHaveBeenCalledWith(context.tenantId, context.branchId, vehicleId);
    expect(requireBranch).toHaveBeenCalledWith(context.branchId, context);
    expect(create).toHaveBeenCalledWith(context.tenantId, context.branchId, {
      imei: '001234567890123',
      vehicleId,
    });
  });
  it.each([
    '',
    ' ',
    '12345678901234',
    '1234567890123456',
    '12345678901234A',
    '１２３４５６７８９０１２３４５',
  ])('rejects invalid IMEI %s before reads and writes', async (imei) => {
    await expect(service.create(context, { imei, vehicleId })).rejects.toThrow(BadRequestException);
    expect(findVehicle).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('rejects a missing or foreign vehicle in create and reassignment', async () => {
    findVehicle.mockResolvedValue(null);
    await expect(service.create(context, { imei: '001234567890123', vehicleId })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(context, randomUUID(), { vehicleId })).rejects.toThrow(
      BadRequestException,
    );
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it('reassigns without calling Core and rejects clearing or empty updates', async () => {
    const id = randomUUID();
    await service.update(context, id, { vehicleId });
    expect(update).toHaveBeenCalledWith(context.tenantId, context.branchId, id, { vehicleId });
    await expect(service.update(context, id, { vehicleId: null })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(context, id, { imei: null })).rejects.toThrow(BadRequestException);
    await expect(service.update(context, id, {})).rejects.toThrow(BadRequestException);
    expect(requireBranch).not.toHaveBeenCalled();
  });
  it.each([
    ['P2002', 'imei'],
    ['P2003', 'vehicleId'],
  ])('maps constraint %s to field %s', async (code, path) => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Constraint', { code, clientVersion: '7' }),
    );
    try {
      await service.create(context, { imei: '001234567890123', vehicleId });
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      if (!(error instanceof BadRequestException)) throw error;
      expect(error.getResponse()).toMatchObject({ fieldErrors: [{ path }] });
    }
  });
});
