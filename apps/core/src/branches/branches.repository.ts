import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class BranchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.client.branch.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  find(tenantId: string, id: string) {
    return this.prisma.client.branch.findUnique({ where: { id, tenantId } });
  }
}
