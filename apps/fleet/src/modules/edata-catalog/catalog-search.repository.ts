import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

/** Reads of the shared vendor catalog; it has no Tenant/Branch columns. */
@Injectable()
export class CatalogSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  latest() {
    return this.prisma.client.edataCatalog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, packageLabel: true },
    });
  }

  profiles(catalogId: string) {
    return this.prisma.client.edataCatalogProfile.findMany({
      where: { catalogId },
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
      include: { category: true, set: { include: { _count: { select: { members: true } } } } },
    });
  }

  profile(catalogId: string, vendorId: number) {
    return this.prisma.client.edataCatalogProfile.findUnique({
      where: { catalogId_vendorId: { catalogId, vendorId } },
      include: { category: true, set: { include: { members: { select: { parameterId: true } } } } },
    });
  }

  monitorParameters(catalogId: string, parameterIds: number[] | undefined) {
    return this.prisma.client.edataCatalogParameter.findMany({
      where: {
        catalogId,
        sourceKey: 'monitor',
        ...(parameterIds && { parameterId: { in: parameterIds } }),
      },
      orderBy: [{ parameterId: 'asc' }, { category: 'asc' }],
      select: { parameterId: true, category: true, name: true, multiply: true, offset: true },
    });
  }
}
