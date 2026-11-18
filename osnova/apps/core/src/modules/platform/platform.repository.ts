import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AccountStatus } from '../../generated/graphql/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

const merchantDetails = {
  branches: { orderBy: [{ name: 'asc' }, { id: 'asc' }] },
  _count: { select: { branches: true } },
} satisfies Prisma.TenantInclude;

@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.client.tenant.findMany({
      where: { kind: 'CUSTOMER' },
      include: merchantDetails,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  create(name: string, adminName: string, adminEmail: string, passwordHash: string) {
    return this.prisma.client.tenant.create({
      data: {
        name,
        users: {
          create: { name: adminName, email: adminEmail, passwordHash, role: 'ADMINISTRATOR' },
        },
      },
      include: merchantDetails,
    });
  }

  async createBranch(tenantId: string, name: string) {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId, kind: 'CUSTOMER' },
    });
    if (!tenant) {
      return null;
    }
    return this.prisma.client.branch.create({ data: { tenantId, name } });
  }

  async setStatus(tenantId: string, status: AccountStatus) {
    return this.prisma.client.tenant.update({
      where: { id: tenantId, kind: 'CUSTOMER' },
      data: { status },
      include: merchantDetails,
    });
  }

  async setBranchStatus(tenantId: string, branchId: string, status: AccountStatus) {
    return this.prisma.client.branch.update({
      where: { id: branchId, tenantId, tenant: { kind: 'CUSTOMER' } },
      data: { status },
    });
  }
}
