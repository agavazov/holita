import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { Scope } from '../scope.js';

const identity = { id: true, name: true, slug: true };

@Injectable()
export class TagsRepository {
  constructor(private readonly database: DatabaseService) {}

  list(scope: Scope, limit: number, words: string[]) {
    return this.database.client.productTag.findMany({
      where: {
        ...scope,
        AND: words.map((word) => ({
          OR: [
            { name: { contains: word, mode: 'insensitive' } },
            { slug: { contains: word, mode: 'insensitive' } },
          ],
        })),
      },
      take: limit,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: identity,
    });
  }

  findByName(scope: Scope, normalizedName: string) {
    return this.database.client.productTag.findUnique({
      where: { tenantId_branchId_normalizedName: { ...scope, normalizedName } },
      select: { id: true },
    });
  }

  private async availableSlug(scope: Scope, normalizedName: string): Promise<string> {
    const base = Array.from(
      normalizedName.replace(/[^\p{L}\p{Nd}]+/gu, '-').replace(/^-|-$/gu, '') || 'tag',
    );
    for (let sequence = 1; ; sequence += 1) {
      const suffix = sequence === 1 ? '' : `-${String(sequence)}`;
      const slug =
        base
          .slice(0, 200 - suffix.length)
          .join('')
          .replace(/-$/u, '') + suffix;
      const existing = await this.database.client.productTag.findUnique({
        where: { tenantId_branchId_slug: { ...scope, slug } },
        select: { id: true },
      });
      if (!existing) {
        return slug;
      }
    }
  }

  async create(scope: Scope, name: string, normalizedName: string) {
    const slug = await this.availableSlug(scope, normalizedName);
    return this.database.client.productTag.create({
      data: { ...scope, name, normalizedName, slug },
      select: identity,
    });
  }
}
