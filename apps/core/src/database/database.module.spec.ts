import { describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { BranchesModule } from '../modules/branches/branches.module.js';
import { TenantsModule } from '../modules/tenants/tenants.module.js';
import { PrismaService } from './prisma.service.js';

describe('Core database ownership', () => {
  it('shares one Prisma client across feature modules and disconnects it once', async () => {
    const module = await Test.createTestingModule({
      imports: [BranchesModule, TenantsModule],
    }).compile();
    const prisma = module.get(PrismaService);
    const disconnect = jest.spyOn(prisma.client, '$disconnect');

    try {
      expect(module.get(PrismaService, { each: true })).toEqual([prisma]);
    } finally {
      await module.close();
    }

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
