import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

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

  create(tenantId: string, name: string, email: string, passwordHash: string) {
    return this.prisma.client.user.create({
      data: { tenantId, name, email, passwordHash },
      include: { tenant: true },
    });
  }

  update(tenantId: string, id: string, name: string, email: string) {
    return this.prisma.client.user.update({
      where: { id, tenantId },
      data: { name, email },
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
