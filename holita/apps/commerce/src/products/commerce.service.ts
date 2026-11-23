import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import { createHash } from 'node:crypto';
import type { Product, ProductInput, QueryProductsArgs } from '../generated/graphql/types.js';
import { InvalidCharacteristicValueError } from '../characteristics/characteristics.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  CommerceRepository,
  ConflictingVariantQuantityError,
  DuplicateBarcodeError,
  DuplicateSkuError,
  InvalidImageIdError,
  InvalidMarkerIdError,
  InvalidVariantIdError,
  InvalidVariantImageIdError,
  VariantOutstandingDeductionsError,
} from './commerce.repository.js';
import { requireScope, type RequestContext } from '../scope.js';
import {
  ProductImages,
  productImageUrl,
  validateProductImages,
  type ProductImageWrite,
} from './product-images.js';
import { VariantOptionValuesError } from './product-variant-options.js';

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
    badges: row.badgeAssignments.map(({ badge }) => badge),
    tags: row.tagAssignments.map(({ tag }) => tag),
    variants: row.variants.map(
      ({
        id,
        sku,
        barcode,
        price,
        weight,
        width,
        height,
        depth,
        quantity,
        minimumQuantity,
        imageId,
        inventoryTracked,
        active,
        values,
      }) => ({
        id,
        sku,
        barcode,
        price: price.toFixed(2),
        weight: weight?.toNumber() ?? null,
        width: width?.toNumber() ?? null,
        height: height?.toNumber() ?? null,
        depth: depth?.toNumber() ?? null,
        quantity,
        minimumQuantity,
        imageId,
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

function measurement(
  index: number,
  field: 'weight' | 'width' | 'height' | 'depth',
  value: number | null | undefined,
) {
  if (value != null && !/^\d{1,9}(?:\.\d{1,3})?$/.test(String(value))) {
    throw variantError(
      index,
      field,
      'INVALID_MEASUREMENT',
      'Enter a non-negative measurement with up to nine whole digits and three decimal places',
    );
  }
  return value;
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
}: Omit<ProductInput, 'variants' | 'images' | 'characteristicValues' | 'badgeIds' | 'tagIds'>) {
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

function invalidMarkerIds(path: 'badgeIds' | 'tagIds') {
  return fieldError(
    path,
    'INVALID_VALUE',
    path === 'badgeIds' ? 'Choose badges from this shop' : 'Choose tags from this shop',
  );
}

function markerIds(input: string[] | null | undefined, field: 'badgeIds' | 'tagIds') {
  const ids = input?.map((id) => id.toLowerCase());
  if (ids?.some((id) => !isUUID(id))) {
    throw invalidMarkerIds(field);
  }
  return ids && [...new Set(ids)];
}

function invalidCharacteristicValue(index: number, field: string, message: string) {
  return fieldError(`characteristicValues.${String(index)}.${field}`, 'INVALID_VALUE', message);
}

function characteristicValues(input: ProductInput['characteristicValues']) {
  const ids = new Set<string>();
  return (input ?? []).map(({ characteristicId: rawId, value, choiceIds: submittedIds }, index) => {
    const characteristicId = rawId.toLowerCase();
    if (!isUUID(characteristicId) || ids.has(characteristicId)) {
      throw invalidCharacteristicValue(
        index,
        'characteristicId',
        'Choose a distinct characteristic from this shop',
      );
    }
    if (value?.includes('\u0000')) {
      throw invalidCharacteristicValue(
        index,
        'value',
        'Characteristic value contains a null character',
      );
    }
    const choiceIds = submittedIds?.map((id) => id.toLowerCase());
    if (
      choiceIds &&
      (choiceIds.some((id) => !isUUID(id)) || new Set(choiceIds).size !== choiceIds.length)
    ) {
      throw invalidCharacteristicValue(
        index,
        'choiceIds',
        'Choose distinct values for this characteristic',
      );
    }
    ids.add(characteristicId);
    return { characteristicId, value: value?.trim() ?? null, choiceIds: choiceIds ?? null };
  });
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
    const {
      variants: requested,
      images: requestedImages,
      characteristicValues: requestedValues,
      badgeIds: requestedBadgeIds,
      tagIds: requestedTagIds,
      ...fields
    } = input;
    const values = characteristicValues(requestedValues);
    const markers = {
      badgeIds: markerIds(requestedBadgeIds, 'badgeIds'),
      tagIds: markerIds(requestedTagIds, 'tagIds'),
    };
    const data = productFields(fields);
    const variants = this.variants(requested, id !== undefined);
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
      saved = await this.repository.save(
        scope,
        id,
        data,
        variants,
        drafts ? images : undefined,
        values,
        markers,
      );
    } catch (error: unknown) {
      await this.imageFiles.remove(scope, newKeys);
      if (error instanceof InvalidCharacteristicValueError) {
        throw invalidCharacteristicValue(error.index, error.field, error.message);
      }
      if (error instanceof InvalidMarkerIdError) {
        throw invalidMarkerIds(error.field);
      }
      if (error instanceof InvalidImageIdError) {
        throw fieldError(`image${String(error.index)}Id`, 'INVALID_IMAGE_ID', error.message);
      }
      if (error instanceof InvalidVariantImageIdError) {
        throw variantError(error.index, 'imageId', 'INVALID_IMAGE_ID', error.message);
      }
      if (error instanceof InvalidVariantIdError) {
        throw variantError(error.index, 'id', 'INVALID_VALUE', error.message);
      }
      if (error instanceof VariantOptionValuesError) {
        throw new UnprocessableEntityException({
          message: error.message,
          fieldErrors: [
            {
              path: `variants.${String(error.index)}.optionValueIds`,
              code: error.code,
              message: error.message,
            },
          ],
        });
      }
      if (error instanceof ConflictingVariantQuantityError) {
        throw variantError(error.index, 'quantity', 'INVENTORY_QUANTITY_CONFLICT', error.message);
      }
      if (error instanceof VariantOutstandingDeductionsError) {
        throw new UnprocessableEntityException({
          message: error.message,
          fieldErrors: [
            {
              path: 'variants',
              code: 'VARIANT_HAS_OUTSTANDING_DEDUCTIONS',
              message: error.message,
            },
          ],
        });
      }
      if (error instanceof DuplicateBarcodeError) {
        throw variantError(error.index, 'barcode', 'DUPLICATE_BARCODE', error.message);
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
          if (error.message.includes('productBadgeAssignment_')) {
            throw invalidMarkerIds('badgeIds');
          }
          if (error.message.includes('productTagAssignment_')) {
            throw invalidMarkerIds('tagIds');
          }
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

  private variants(input: ProductInput['variants'], updating: boolean) {
    if (input.length === 0) {
      throw fieldError('variants', 'REQUIRED', 'Add a product variant');
    }
    const ids = new Set<string>();
    const skus = new Set<string>();
    return input.map(
      (
        {
          id: rawId,
          sku: rawSku,
          barcode: rawBarcode,
          price,
          weight,
          width,
          height,
          depth,
          quantity: initialQuantity,
          minimumQuantity,
          imageId: rawImageId,
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
        const imageId = typeof rawImageId === 'string' ? rawImageId.toLowerCase() : rawImageId;
        if (typeof imageId === 'string' && (!updating || !isUUID(imageId))) {
          throw variantError(
            index,
            'imageId',
            'INVALID_IMAGE_ID',
            'Choose an image from this product',
          );
        }
        if (
          minimumQuantity !== undefined &&
          (minimumQuantity === null ||
            !Number.isInteger(minimumQuantity) ||
            minimumQuantity < 1 ||
            minimumQuantity > 2_147_483_647)
        ) {
          throw variantError(
            index,
            'minimumQuantity',
            'INVALID_VALUE',
            'Enter a positive whole quantity',
          );
        }
        const sku = rawSku.trim();
        if (!sku || Array.from(sku).length > 100 || sku.includes('\u0000')) {
          throw variantError(index, 'sku', 'INVALID_VALUE', 'SKU must contain 1 to 100 characters');
        }
        if (skus.has(sku)) {
          throw variantError(index, 'sku', 'DUPLICATE_SKU', 'This shop already uses the SKU');
        }
        skus.add(sku);
        const barcode = rawBarcode === undefined ? undefined : rawBarcode?.trim() || null;
        if (barcode && (Array.from(barcode).length > 255 || barcode.includes('\u0000'))) {
          throw variantError(
            index,
            'barcode',
            'INVALID_BARCODE',
            'Enter a barcode of up to 255 characters',
          );
        }
        if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(price)) {
          throw variantError(
            index,
            'price',
            'INVALID_VALUE',
            'Enter a non-negative price with up to two decimal places',
          );
        }
        const quantity = initialQuantity ?? undefined;
        if (
          quantity !== undefined &&
          (!Number.isInteger(quantity) || quantity < 0 || quantity > 2_147_483_647)
        ) {
          throw variantError(
            index,
            'quantity',
            'INVALID_VALUE',
            'Enter a non-negative whole quantity',
          );
        }
        if (!id && !inventoryTracked && (quantity ?? 0) !== 0) {
          throw variantError(
            index,
            'quantity',
            'INVENTORY_TRACKING_REQUIRED',
            'Enable inventory tracking to set an initial quantity',
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
        return {
          ...(id ? { id } : {}),
          sku,
          barcode,
          price,
          weight: measurement(index, 'weight', weight),
          width: measurement(index, 'width', width),
          height: measurement(index, 'height', height),
          depth: measurement(index, 'depth', depth),
          quantity,
          minimumQuantity,
          imageId,
          inventoryTracked,
          active,
          optionValueIds,
          combinationKey: createHash('sha256').update(optionValueIds.join(',')).digest('hex'),
          sortOrder: index,
        };
      },
    );
  }
}
