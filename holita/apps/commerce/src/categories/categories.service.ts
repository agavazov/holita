import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type { CatalogueCategory } from '../generated/graphql/storefront-types.js';
import type { Category, CategoryInput } from '../generated/graphql/types.js';
import { Prisma, type Category as StoredCategory } from '../generated/prisma/client.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import { CategoriesRepository } from './categories.repository.js';

function categoryError(path: string, code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function conflict(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'CONFLICT' } });
}

function invalidParent(): GraphQLError {
  return categoryError('parentId', 'INVALID_VALUE', 'Choose a parent category from this shop');
}

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Category ID must be a UUID');
  }
  return id.toLowerCase();
}

function fields(input: CategoryInput) {
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
    throw categoryError('name', 'INVALID_VALUE', 'Category name must contain 1 to 200 characters');
  }
  if (slug.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw categoryError('slug', 'INVALID_FORMAT', 'Use lowercase letters, digits and hyphens');
  }
  if (typeof input.parentId === 'string' && !isUUID(input.parentId)) {
    throw invalidParent();
  }
  if (input.sortOrder < 0) {
    throw categoryError('sortOrder', 'INVALID_VALUE', 'Sort order must be a non-negative integer');
  }
  return { ...input, name, slug, parentId: input.parentId?.toLowerCase() ?? null };
}

function publicCategory(row: StoredCategory) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
  };
}

function present(row: StoredCategory): Category {
  return { ...publicCategory(row), active: row.active };
}

function treeOrder(rows: StoredCategory[]): StoredCategory[] {
  const children = new Map<string | null, StoredCategory[]>();
  for (const row of rows) {
    const siblings = children.get(row.parentId);
    if (siblings) {
      siblings.push(row);
    } else {
      children.set(row.parentId, [row]);
    }
  }
  const tree: StoredCategory[] = [];
  function visit(parentId: string | null): void {
    for (const row of children.get(parentId) ?? []) {
      tree.push(row);
      visit(row.id);
    }
  }
  visit(null);
  return tree;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  async list(context: RequestContext) {
    const scope = await requireScope(context, false);
    return treeOrder(await this.repository.list(scope)).map(present);
  }

  async publicTree(scope: Scope): Promise<CatalogueCategory[]> {
    return treeOrder(await this.repository.list(scope, true)).map(publicCategory);
  }

  async find(context: RequestContext, id: string) {
    const row = await this.repository.find(await requireScope(context, false), recordId(id));
    return row ? present(row) : null;
  }

  async save(context: RequestContext, input: CategoryInput, id?: string) {
    const scope = await requireScope(context, true);
    const data = fields(input);
    try {
      const row =
        id === undefined
          ? await this.repository.create(scope, data)
          : await this.repository.update(scope, recordId(id), data);
      if (!row) {
        throw categoryError('parentId', 'CATEGORY_CYCLE', 'Choose a parent outside this subtree');
      }
      return present(row);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw categoryError('slug', 'DUPLICATE_VALUE', 'This shop already uses the slug');
        }
        if (error.code === 'P2003') {
          throw invalidParent();
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Category not found');
        }
        if (error.code === 'P2034') {
          throw conflict('Categories changed while saving. Try again.');
        }
      }
      throw error;
    }
  }

  async delete(context: RequestContext, id: string): Promise<boolean> {
    const scope = await requireScope(context, true);
    try {
      await this.repository.delete(scope, recordId(id));
      return true;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Category not found');
        }
        if (error.code === 'P2003') {
          throw conflict(
            'Move subcategories and remove product assignments before deleting this category',
          );
        }
      }
      throw error;
    }
  }
}
