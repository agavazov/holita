import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class StoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.client.store.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }

  find(id: string) {
    return this.prisma.client.store.findUnique({ where: { id } });
  }
}
