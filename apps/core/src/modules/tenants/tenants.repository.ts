import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.client.tenant.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }
  find(id: string) {
    return this.prisma.client.tenant.findUnique({ where: { id } });
  }
}
