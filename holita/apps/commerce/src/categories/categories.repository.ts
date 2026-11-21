import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { CategoryInput } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Scope } from '../scope.js';

type CategoryFields = CategoryInput & { parentId: string | null };

@Injectable()
export class CategoriesRepository {
  constructor(private readonly database: DatabaseService) {}

  list(scope: Scope, activeOnly = false) {
    return this.database.client.category.findMany({
      where: { ...scope, ...(activeOnly ? { active: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  find(scope: Scope, id: string) {
    return this.database.client.category.findUnique({ where: { ...scope, id } });
  }

  create(scope: Scope, fields: CategoryFields) {
    return this.database.client.category.create({ data: { ...scope, ...fields } });
  }

  update(scope: Scope, id: string, fields: CategoryFields) {
    return this.database.client.$transaction(
      async (tx) => {
        let parentId = fields.parentId;
        while (parentId) {
          if (parentId === id) {
            return null;
          }
          const parent: { parentId: string | null } | null = await tx.category.findUnique({
            where: { ...scope, id: parentId },
            select: { parentId: true },
          });
          parentId = parent?.parentId ?? null;
        }
        return tx.category.update({ where: { ...scope, id }, data: fields });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  delete(scope: Scope, id: string) {
    return this.database.client.category.delete({ where: { ...scope, id } });
  }
}
