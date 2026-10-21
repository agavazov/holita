import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from '../../graphql/request-context.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BranchesRepository } from './branches.repository.js';
import { BranchesService } from './branches.service.js';

describe('Branch name updates', () => {
  const updateName = jest.fn<BranchesRepository['updateName']>();
  const tenantId = randomUUID();
  const branchId = randomUUID();
  const context: RequestContext = {
    requestId: randomUUID(),
    tenantId,
    branchId,
    authorization: undefined,
  };
  let service: BranchesService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [BranchesService, { provide: BranchesRepository, useValue: { updateName } }],
    }).compile();
    service = module.get(BranchesService);
    updateName.mockResolvedValue({
      id: branchId,
      tenantId,
      name: 'Renamed',
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-20T00:00:00Z'),
    });
  });

  it('normalizes the selected UUID and trims 80 Unicode characters without changing identity', async () => {
    const name = '🚚'.repeat(80);
    await expect(
      service.updateName(
        { ...context, branchId: branchId.toUpperCase() },
        branchId.toUpperCase(),
        `  ${name}  `,
      ),
    ).resolves.toMatchObject({ id: branchId, tenantId });
    expect(updateName).toHaveBeenCalledTimes(1);
    expect(updateName).toHaveBeenCalledWith(tenantId, branchId, name);
  });

  it.each([
    { name: '', code: 'REQUIRED' },
    { name: ' \t ', code: 'REQUIRED' },
    { name: 'x'.repeat(81), code: 'TOO_LONG' },
    { name: '🚚'.repeat(81), code: 'TOO_LONG' },
    { name: 'Fleet\u0000name', code: 'INVALID_FORMAT' },
  ])(
    'rejects an invalid name with a name field error before persistence',
    async ({ name, code }) => {
      await expect(service.updateName(context, branchId, name)).rejects.toMatchObject({
        response: {
          message: 'Use 1 to 80 supported characters.',
          fieldErrors: [{ path: 'name', message: 'Use 1 to 80 supported characters.', code }],
        },
      });
      expect(updateName).not.toHaveBeenCalled();
    },
  );

  it('requires an authenticated tenant before selecting or changing a Branch', async () => {
    await expect(
      service.updateName({ ...context, tenantId: undefined }, branchId, 'Changed'),
    ).rejects.toThrow(UnauthorizedException);
    expect(updateName).not.toHaveBeenCalled();
  });

  it('rejects missing, malformed or mismatched selected Branch context without persistence', async () => {
    for (const selected of [undefined, 'invalid', randomUUID()]) {
      await expect(
        service.updateName({ ...context, branchId: selected }, branchId, 'Changed'),
      ).rejects.toThrow(BadRequestException);
    }
    await expect(service.updateName(context, 'invalid', 'Changed')).rejects.toThrow(
      BadRequestException,
    );
    expect(updateName).not.toHaveBeenCalled();
  });

  it('maps missing or foreign scoped updates to NOT_FOUND and preserves unexpected failures', async () => {
    updateName.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Missing scoped Branch', {
        code: 'P2025',
        clientVersion: '7',
      }),
    );
    await expect(service.updateName(context, branchId, 'Changed')).rejects.toThrow(
      new NotFoundException('Branch not found'),
    );
    const unavailable = new Error('Persistence unavailable');
    updateName.mockRejectedValueOnce(unavailable);
    await expect(service.updateName(context, branchId, 'Changed')).rejects.toBe(unavailable);
  });
});
