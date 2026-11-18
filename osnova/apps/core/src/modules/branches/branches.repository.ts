import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class BranchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.client.branch.findMany({
      where: { tenantId, status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  find(tenantId: string, id: string) {
    return this.prisma.client.branch.findUnique({
      where: { id, tenantId, status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
    });
  }

  resolvePublic(id: string) {
    return this.prisma.client.branch.findUnique({
      where: { id, status: 'ACTIVE', tenant: { kind: 'CUSTOMER', status: 'ACTIVE' } },
      select: { id: true, tenantId: true, name: true },
    });
  }

  updateName(tenantId: string, id: string, name: string) {
    return this.prisma.client.branch.update({
      where: { id, tenantId, status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
      data: { name },
    });
  }
}
