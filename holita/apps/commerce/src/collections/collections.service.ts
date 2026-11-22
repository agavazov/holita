import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type {
  ProductCollection,
  ProductCollectionInput,
  QueryProductCollectionsArgs,
} from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import {
  CollectionsRepository,
  InvalidCollectionReferenceError,
} from './collections.repository.js';

function fieldError(path: string, code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function invalidReference(path: 'categoryId' | 'brandId' | 'productIds') {
  const message = {
    categoryId: 'Choose a category from this shop',
    brandId: 'Choose a brand from this shop',
    productIds: 'Choose products from this shop',
  }[path];
  return fieldError(path, 'INVALID_VALUE', message);
}

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Collection ID must be a UUID');
  }
  return id.toLowerCase();
}

function validSlug(slug: string): boolean {
  return slug.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function fields(input: ProductCollectionInput) {
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
    throw fieldError('name', 'INVALID_VALUE', 'Collection name must contain 1 to 200 characters');
  }
  if (!validSlug(slug)) {
    throw fieldError('slug', 'INVALID_FORMAT', 'Use lowercase letters, digits and hyphens');
  }
  const { active, mode } = input;
  const categoryId = input.categoryId?.toLowerCase() ?? null;
  const brandId = input.brandId?.toLowerCase() ?? null;
  const productIds = (input.productIds ?? []).map((id) => id.toLowerCase());
  if (
    (mode !== 'CATEGORY' && categoryId !== null) ||
    (mode !== 'BRAND' && brandId !== null) ||
    (mode !== 'MANUAL' && productIds.length)
  ) {
    throw fieldError('mode', 'INVALID_VALUE', 'Choose one membership mode for the collection');
  }
  if (mode === 'CATEGORY' && (!categoryId || !isUUID(categoryId))) {
    throw invalidReference('categoryId');
  }
  if (mode === 'BRAND' && (!brandId || !isUUID(brandId))) {
    throw invalidReference('brandId');
  }
  if (productIds.some((id) => !isUUID(id))) {
    throw invalidReference('productIds');
  }
  if (new Set(productIds).size !== productIds.length) {
    throw fieldError('productIds', 'DUPLICATE_VALUE', 'Choose each product only once');
  }
  return { data: { name, slug, active, mode, categoryId, brandId }, productIds };
}

type CollectionRow = NonNullable<Awaited<ReturnType<CollectionsRepository['find']>>>;

function present({
  items,
  id,
  name,
  slug,
  active,
  mode,
  categoryId,
  brandId,
}: CollectionRow): ProductCollection {
  return {
    id,
    name,
    slug,
    active,
    mode,
    categoryId,
    brandId,
    manualProducts: items.map(({ product }) => product),
  };
}

@Injectable()
export class CollectionsService {
  constructor(private readonly repository: CollectionsRepository) {}

  async list(context: RequestContext, args: QueryProductCollectionsArgs) {
    const scope = await requireScope(context, false);
    const { offset = 0, limit = 20 } = args;
    const search = (args.search ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    return this.repository.list(scope, offset, limit, words, args.sort);
  }

  async find(context: RequestContext, id: string) {
    const row = await this.repository.find(await requireScope(context, false), recordId(id));
    return row ? present(row) : null;
  }

  async save(context: RequestContext, input: ProductCollectionInput, rawId?: string) {
    const scope = await requireScope(context, true);
    const id = rawId === undefined ? undefined : recordId(rawId);
    const { data, productIds } = fields(input);
    try {
      return present(await this.repository.save(scope, id, data, productIds));
    } catch (error: unknown) {
      if (error instanceof InvalidCollectionReferenceError) {
        throw invalidReference(error.field);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw fieldError('slug', 'DUPLICATE_VALUE', 'This shop already uses the slug');
        }
        if (error.code === 'P2003') {
          throw invalidReference(
            data.mode === 'CATEGORY'
              ? 'categoryId'
              : data.mode === 'BRAND'
                ? 'brandId'
                : 'productIds',
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Collection not found');
        }
      }
      throw error;
    }
  }

  publicList(scope: Scope, offset: number, limit: number) {
    return this.repository.publicList(scope, offset, limit);
  }
}
