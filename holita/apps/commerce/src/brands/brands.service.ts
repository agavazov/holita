import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Brand, BrandInput, QueryBrandsArgs } from '../generated/graphql/types.js';
import { Prisma, type Brand as StoredBrand } from '../generated/prisma/client.js';
import { requireScope, type RequestContext } from '../scope.js';
import { BrandImages, brandInputError, brandLogoUrl } from './brand-images.js';
import { BrandsRepository } from './brands.repository.js';

function present(row: StoredBrand): Brand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    logoUrl: brandLogoUrl(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Brand ID must be a UUID');
  }
  return id.toLowerCase();
}

function fields(input: BrandInput) {
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
    throw brandInputError('name', 'INVALID_VALUE', 'Brand name must contain 1 to 200 characters');
  }
  if (slug.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw brandInputError('slug', 'INVALID_FORMAT', 'Use lowercase letters, digits and hyphens');
  }
  return { name, slug, status: input.status };
}

@Injectable()
export class BrandsService {
  constructor(
    private readonly repository: BrandsRepository,
    private readonly images: BrandImages,
  ) {}

  async list(context: RequestContext, args: QueryBrandsArgs) {
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
    const result = await this.repository.list(scope, offset, limit, words, args.sort);
    return { ...result, items: result.items.map(present) };
  }

  async find(context: RequestContext, id: string) {
    const row = await this.repository.find(await requireScope(context, false), recordId(id));
    return row ? present(row) : null;
  }

  async save(context: RequestContext, input: BrandInput, id?: string) {
    const scope = await requireScope(context, true);
    const data = fields(input);
    const key = id === undefined ? undefined : recordId(id);
    const previous = key ? await this.repository.find(scope, key) : null;
    if (key && !previous) {
      throw new NotFoundException('Brand not found');
    }
    const logoKey =
      typeof input.logo === 'string' ? await this.images.write(scope, input.logo) : input.logo;
    try {
      const row = key
        ? await this.repository.update(
            scope,
            key,
            data,
            logoKey,
            logoKey !== undefined ? previous?.logoKey : undefined,
          )
        : await this.repository.create(scope, data, logoKey ?? null);
      if (previous && logoKey !== undefined) {
        await this.images.remove(scope, previous.logoKey);
      }
      return present(row);
    } catch (error: unknown) {
      if (logoKey) {
        await this.images.remove(scope, logoKey);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw brandInputError('slug', 'DUPLICATE_VALUE', 'This shop already uses the slug');
        }
        if (error.code === 'P2025') {
          throw new ConflictException('Brand changed while saving');
        }
      }
      throw error;
    }
  }

  async delete(context: RequestContext, id: string): Promise<boolean> {
    const scope = await requireScope(context, true);
    try {
      const row = await this.repository.delete(scope, recordId(id));
      await this.images.remove(scope, row.logoKey);
      return true;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Brand not found');
        }
        if (error.code === 'P2003') {
          throw new ConflictException('Brand assignments changed');
        }
      }
      throw error;
    }
  }
}
