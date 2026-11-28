import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AccountStatus } from '../../generated/graphql/types.js';
import type { Prisma } from '../../generated/prisma/client.js';

const merchantDetails = {
  branches: { orderBy: [{ name: 'asc' }, { id: 'asc' }] },
  _count: { select: { branches: true } },
} satisfies Prisma.TenantInclude;

export interface MerchantProvisioningInput {
  operationId: string;
  merchantName: string;
  adminName: string;
  adminEmail: string;
  branchName: string;
}

function merchantAccount(
  name: string,
  adminName: string,
  adminEmail: string,
  passwordHash: string,
) {
  return {
    name,
    users: {
      create: { name: adminName, email: adminEmail, passwordHash, role: 'ADMINISTRATOR' },
    },
  } satisfies Prisma.TenantCreateInput;
}

@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(offset: number, limit: number) {
    const { client } = this.prisma;
    const where = { kind: 'CUSTOMER' } satisfies Prisma.TenantWhereInput;
    return client.$transaction([
      client.tenant.findMany({
        where,
        select: { id: true, name: true, status: true, _count: merchantDetails._count },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
      client.tenant.count({ where }),
    ]);
  }

  find(tenantId: string) {
    return this.prisma.client.tenant.findUnique({
      where: { id: tenantId, kind: 'CUSTOMER' },
      include: merchantDetails,
    });
  }

  create(name: string, adminName: string, adminEmail: string, passwordHash: string) {
    return this.prisma.client.tenant.create({
      data: merchantAccount(name, adminName, adminEmail, passwordHash),
      include: merchantDetails,
    });
  }

  findProvisioning(platformTenantId: string, operationId: string) {
    return this.prisma.client.merchantProvisioning.findUnique({
      where: { platformTenantId_operationId: { platformTenantId, operationId } },
    });
  }

  provisionMerchant(
    platformTenantId: string,
    input: MerchantProvisioningInput,
    passwordHash: string,
  ) {
    return this.prisma.client.$transaction(async (transaction) => {
      const { id: merchantTenantId } = await transaction.tenant.create({
        data: merchantAccount(input.merchantName, input.adminName, input.adminEmail, passwordHash),
        select: { id: true },
      });
      const { id: branchId } = await transaction.branch.create({
        data: { tenantId: merchantTenantId, name: input.branchName },
        select: { id: true },
      });
      return transaction.merchantProvisioning.create({
        data: { platformTenantId, merchantTenantId, branchId, ...input },
        select: { merchantTenantId: true, branchId: true },
      });
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
