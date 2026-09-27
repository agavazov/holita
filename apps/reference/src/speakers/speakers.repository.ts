import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateReferenceSpeakerInput } from '../generated/graphql/types.js';
import type { lookup } from '../validation.js';

@Injectable()
export class SpeakersRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(storeId: string, offset: number, limit: number, filter?: ReturnType<typeof lookup>) {
    const where = {
      storeId,
      ...(filter?.search
        ? {
            name: {
              contains: filter.search.replace(/[\\%_]/g, '\\$&'),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(filter?.active !== undefined ? { active: filter.active } : {}),
      ...(filter?.ids ? { id: { in: filter.ids } } : {}),
    };
    const [items, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.speaker.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.client.speaker.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, offset, limit };
  }
  find(storeId: string, id: string) {
    return this.prisma.client.speaker.findUnique({ where: { id, storeId } });
  }
  create(storeId: string, input: CreateReferenceSpeakerInput) {
    return this.prisma.client.speaker.create({ data: { ...input, storeId } });
  }
  update(storeId: string, id: string, input: Partial<CreateReferenceSpeakerInput>) {
    return this.prisma.client.speaker.update({ where: { id, storeId }, data: input });
  }
  delete(storeId: string, id: string) {
    return this.prisma.client.speaker.delete({ where: { id, storeId } });
  }
}
