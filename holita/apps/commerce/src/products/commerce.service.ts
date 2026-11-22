import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { createHash } from 'node:crypto';
import type { Product, ProductInput, QueryProductsArgs } from '../generated/graphql/types.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  CommerceRepository,
  DuplicateSkuError,
  InvalidImageIdError,
  InvalidVariantIdError,
} from './commerce.repository.js';
import { requireScope, type RequestContext, type Scope } from '../scope.js';
import {
  ProductImages,
  productImageUrl,
  validateProductImages,
  type ProductImageWrite,
} from './product-images.js';

type ProductRow = Awaited<ReturnType<CommerceRepository['save']>>['row'];

function product(row: ProductRow): Product {
  let price: Prisma.Decimal | undefined;
  for (const variant of row.variants) {
    if (variant.active && (!price || variant.price.lt(price))) {
      price = variant.price;
    }
  }
  return {
    id: row.id,
    name: row.name,
    descriptionBg: row.descriptionBg,
    descriptionEn: row.descriptionEn,
    price: price?.toFixed(2) ?? null,
    status: row.status,
    brandId: row.brandId,
    categoryId: row.categoryId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    images: row.images.map((image) => ({
      id: image.id,
      url: productImageUrl(image),
      altText: image.altText,
    })),
    variants: row.variants.map(
      ({ id, sku, price, quantity, inventoryTracked, active, values }) => ({
        id,
        sku,
        price: price.toFixed(2),
        quantity,
        inventoryTracked,
        active,
        optionValueIds: values.map(({ optionValueId }) => optionValueId),
      }),
    ),
  };
}

function fieldError(path: string, code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

function variantError(index: number, field: string, code: string, message: string) {
  return fieldError(`variants.${String(index)}.${field}`, code, message);
}

function description(value: string | null, path: 'descriptionBg' | 'descriptionEn'): string | null {
  if (value?.includes('\u0000')) {
    throw fieldError(path, 'INVALID_VALUE', 'Product description contains a null character');
  }
  return value?.trim() || null;
}

function productFields({
  descriptionBg,
  descriptionEn,
  ...input
}: Omit<ProductInput, 'variants' | 'images'>) {
  const name = input.name.trim();
  if (!name || Array.from(name).length > 200 || name.includes('\u0000')) {
    throw fieldError('name', 'INVALID_VALUE', 'Product name must contain 1 to 200 characters');
  }
  if (typeof input.brandId === 'string' && !isUUID(input.brandId)) {
    throw invalidReference('brandId');
  }
  if (typeof input.categoryId === 'string' && !isUUID(input.categoryId)) {
    throw invalidReference('categoryId');
  }
  return {
    ...input,
    name,
    ...(descriptionBg === undefined
      ? {}
      : { descriptionBg: description(descriptionBg, 'descriptionBg') }),
    ...(descriptionEn === undefined
      ? {}
      : { descriptionEn: description(descriptionEn, 'descriptionEn') }),
    ...(typeof input.brandId === 'string' ? { brandId: input.brandId.toLowerCase() } : {}),
    ...(typeof input.categoryId === 'string' ? { categoryId: input.categoryId.toLowerCase() } : {}),
  };
}

function invalidReference(path: 'brandId' | 'categoryId') {
  return fieldError(
    path,
    'INVALID_VALUE',
    path === 'brandId' ? 'Choose a brand from this shop' : 'Choose a category from this shop',
  );
}

function recordId(id: string): string {
  if (!isUUID(id)) {
    throw new BadRequestException('Product ID must be a UUID');
  }
  return id.toLowerCase();
}

@Injectable()
export class CommerceService {
  constructor(
    private readonly repository: CommerceRepository,
    private readonly imageFiles: ProductImages,
  ) {}

  async products(context: RequestContext, args: QueryProductsArgs) {
    const scope = await requireScope(context, false);
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 20;
    if (offset < 0 || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page');
    }
    const search = (args.search ?? '').trim();
    const words = search.split(/\s+/u).filter(Boolean);
    if (Array.from(search).length > 200 || words.length > 5 || search.includes('\u0000')) {
      throw new BadRequestException('Invalid search');
    }
    if (
      args.filter?.statuses &&
      (args.filter.statuses.length === 0 || args.filter.statuses.length > 100)
    ) {
      throw new BadRequestException('Invalid product status filter');
    }
    const result = await this.repository.products(
      scope,
      offset,
      limit,
      words,
      args.filter,
      args.sort,
    );
    return { ...result, items: result.items.map(product) };
  }

  async product(context: RequestContext, id: string) {
    const row = await this.repository.product(await requireScope(context, false), recordId(id));
    return row ? product(row) : null;
  }

  async create(context: RequestContext, input: ProductInput) {
    return this.save(context, input);
  }

  async update(context: RequestContext, id: string, input: ProductInput) {
    return this.save(context, input, id);
  }

  private async save(context: RequestContext, input: ProductInput, rawId?: string) {
    const scope = await requireScope(context, true);
    const id = rawId === undefined ? undefined : recordId(rawId);
    const { variants: requested, images: requestedImages, ...fields } = input;
    const data = productFields(fields);
    const variants = await this.variants(scope, requested, id !== undefined);
    const drafts = validateProductImages(requestedImages, id !== undefined);
    const newKeys: string[] = [];
    let saved: Awaited<ReturnType<CommerceRepository['save']>>;
    try {
      const images: ProductImageWrite[] = [];
      for (const draft of drafts ?? []) {
        if ('upload' in draft) {
          const { upload, ...fields } = draft;
          const storageKey = await this.imageFiles.write(scope, upload);
          newKeys.push(storageKey);
          images.push({ ...fields, storageKey });
        } else {
          images.push(draft);
        }
      }
      saved = await this.repository.save(scope, id, data, variants, drafts ? images : undefined);
    } catch (error: unknown) {
      await this.imageFiles.remove(scope, newKeys);
      if (error instanceof InvalidImageIdError) {
        throw fieldError(`images.${String(error.index)}.id`, 'INVALID_IMAGE_ID', error.message);
      }
      if (error instanceof InvalidVariantIdError) {
        throw variantError(error.index, 'id', 'INVALID_VALUE', error.message);
      }
      if (error instanceof DuplicateSkuError) {
        const index = variants.findIndex((variant) => variant.sku === error.sku);
        throw variantError(index, 'sku', 'DUPLICATE_SKU', error.message);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Product not found');
        }
        if (error.code === 'P2002') {
          throw fieldError('variants', 'DUPLICATE_SKU', 'This shop already uses the SKU');
        }
        if (error.code === 'P2003') {
          if (error.message.includes('productVariantValue_tenantId_branchId_optionValueId_fkey')) {
            throw fieldError('variants', 'INVALID_OPTION_VALUES', 'Choose values from this shop');
          }
          throw invalidReference(
            error.message.includes('product_tenantId_branchId_categoryId_fkey')
              ? 'categoryId'
              : 'brandId',
          );
        }
      }
      throw error;
    }
    await this.imageFiles.remove(scope, saved.retiredKeys);
    return product(saved.row);
  }

  private async variants(scope: Scope, input: ProductInput['variants'], updating: boolean) {
    if (input.length === 0) {
      throw fieldError('variants', 'REQUIRED', 'Add a product variant');
    }
    const ids = new Set<string>();
    const skus = new Set<string>();
    const combinations = new Set<string>();
    const variants = input.map(
      (
        {
          id: rawId,
          sku: rawSku,
          price,
          quantity,
          inventoryTracked,
          active,
          optionValueIds: values,
        },
        index,
      ) => {
        const id = rawId?.toLowerCase();
        if (id !== undefined && (!updating || !isUUID(id) || ids.has(id))) {
          throw variantError(index, 'id', 'INVALID_VALUE', 'Choose a variant from this product');
        }
        if (id) {
          ids.add(id);
        }
        const sku = rawSku.trim();
        if (!sku || Array.from(sku).length > 100 || sku.includes('\u0000')) {
          throw variantError(index, 'sku', 'INVALID_VALUE', 'SKU must contain 1 to 100 characters');
        }
        if (skus.has(sku)) {
          throw variantError(index, 'sku', 'DUPLICATE_SKU', 'This shop already uses the SKU');
        }
        skus.add(sku);
        if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(price)) {
          throw variantError(
            index,
            'price',
            'INVALID_VALUE',
            'Enter a non-negative price with up to two decimal places',
          );
        }
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2_147_483_647) {
          throw variantError(
            index,
            'quantity',
            'INVALID_VALUE',
            'Enter a non-negative whole quantity',
          );
        }
        const optionValueIds = values.map((value) => value.toLowerCase()).sort();
        if (optionValueIds.some((value) => !isUUID(value))) {
          throw variantError(
            index,
            'optionValueIds',
            'INVALID_OPTION_VALUES',
            'Choose values from this shop',
          );
        }
        const key = optionValueIds.join(',');
        if (combinations.has(key)) {
          throw variantError(
            index,
            'optionValueIds',
            'DUPLICATE_COMBINATION',
            'This product already has this combination',
          );
        }
        combinations.add(key);
        return {
          ...(id ? { id } : {}),
          sku,
          price,
          quantity,
          inventoryTracked,
          active,
          optionValueIds,
          combinationKey: createHash('sha256').update(key).digest('hex'),
          sortOrder: index,
        };
      },
    );
    const valueIds = [...new Set(variants.flatMap((variant) => variant.optionValueIds))];
    if (!valueIds.length) {
      return variants;
    }
    const values = await this.repository.optionValues(scope, valueIds);
    const optionsByValue = new Map(values.map(({ id, optionId }) => [id, optionId]));
    let expectedOptions: string | undefined;
    for (const [index, variant] of variants.entries()) {
      const optionIds = variant.optionValueIds.map((id) => optionsByValue.get(id));
      if (optionIds.includes(undefined) || new Set(optionIds).size !== optionIds.length) {
        throw variantError(
          index,
          'optionValueIds',
          'INVALID_OPTION_VALUES',
          'Choose one value per option from this shop',
        );
      }
      const options = optionIds.sort().join(',');
      expectedOptions ??= options;
      if (options !== expectedOptions) {
        throw variantError(
          index,
          'optionValueIds',
          'MISMATCHED_OPTIONS',
          'Use the same options in each variant',
        );
      }
    }
    return variants;
  }
}
