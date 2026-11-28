import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { UserRole } from '../../generated/graphql/types.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.client.user.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { tenant: true },
    });
  }

  find(tenantId: string, id: string) {
    return this.prisma.client.user.findUnique({
      where: { id, tenantId },
      include: { tenant: true },
    });
  }

  salesAgents(
    tenantId: string,
    lookup: { ids: string[]; historicalIds: string[] } | { search: string },
  ) {
    return this.prisma.client.user.findMany({
      where: {
        tenantId,
        ...('ids' in lookup
          ? {
              OR: [
                { id: { in: lookup.ids }, role: 'SALES', active: true },
                { id: { in: lookup.historicalIds } },
              ],
            }
          : {
              role: 'SALES',
              active: true,
              name: { contains: lookup.search.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' },
            }),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, active: true, role: true },
    });
  }

  create(tenantId: string, name: string, email: string, passwordHash: string, role: UserRole) {
    return this.prisma.client.user.create({
      data: { tenantId, name, email, passwordHash, role },
      include: { tenant: true },
    });
  }

  update(tenantId: string, id: string, name: string, email: string, role?: UserRole) {
    return this.prisma.client.user.update({
      where: { id, tenantId },
      data: { name, email, ...(role === undefined ? {} : { role }) },
      include: { tenant: true },
    });
  }

  setActive(tenantId: string, id: string, active: boolean) {
    return this.prisma.client.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id, tenantId },
        data: { active },
        include: { tenant: true },
      });
      if (!active) {
        await transaction.session.updateMany({
          where: { tenantId, userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return user;
    });
  }
}
