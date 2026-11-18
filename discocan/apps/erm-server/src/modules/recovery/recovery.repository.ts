import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class RecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  record(data: Prisma.ErmRecoverySessionCreateInput) {
    return this.prisma.client.ermRecoverySession.create({ data });
  }
}
