import { Injectable, Logger } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { GraphQLError } from 'graphql';
import type { ProductInput } from '../generated/graphql/types.js';
import {
  imageDirectory,
  maxImageBytes,
  rasterUpload,
  readImage,
  removeImage,
  writeImage,
} from '../media/image-files.js';
import type { Scope } from '../scope.js';

export type ProductImageWrite =
  | { id: string; altText: string | null; sortOrder: number }
  | { storageKey: string; altText: string | null; sortOrder: number };

function imageInputError(path: string, code: string, message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

export function productImageUrl(row: { branchId: string; storageKey: string }) {
  return `/media/products/${row.branchId}/${row.storageKey}`;
}

type ProductImageDraft =
  | { id: string; altText: string | null; sortOrder: number }
  | {
      upload: NonNullable<ReturnType<typeof rasterUpload>>;
      altText: string | null;
      sortOrder: number;
    };

export function validateProductImages(
  input: ProductInput['images'],
  updating: boolean,
): ProductImageDraft[] | undefined {
  if (input === null) {
    throw imageInputError('images', 'INVALID_GALLERY', 'Provide an ordered list of images');
  }
  let total = 0;
  const ids = new Set<string>();
  return input?.map(({ id: rawId, upload: encoded, altText }, sortOrder) => {
    const id = rawId?.toLowerCase();
    const path = `image${String(sortOrder)}`;
    if (id !== undefined && (!updating || !isUUID(id) || ids.has(id))) {
      throw imageInputError(`${path}Id`, 'INVALID_IMAGE_ID', 'Choose an image from this product');
    }
    if (altText?.includes('\u0000')) {
      throw imageInputError(
        `${path}AltText`,
        'INVALID_ALT_TEXT',
        'Alt text contains a null character',
      );
    }
    const fields = { altText: altText?.trim() || null, sortOrder };
    if (id !== undefined && encoded == null) {
      ids.add(id);
      return { ...fields, id };
    }
    const upload = id === undefined && typeof encoded === 'string' ? rasterUpload(encoded) : null;
    if (!upload) {
      throw imageInputError(
        `${path}Upload`,
        'INVALID_IMAGE',
        'Choose a JPEG, PNG or WebP image up to 5 MiB',
      );
    }
    total += upload.bytes.length;
    if (total > maxImageBytes) {
      throw imageInputError(
        'images',
        'IMAGE_BATCH_TOO_LARGE',
        'New images can total up to 5 MiB per save',
      );
    }
    return { ...fields, upload };
  });
}

@Injectable()
export class ProductImages {
  private readonly logger = new Logger(ProductImages.name);

  write(scope: Scope, upload: NonNullable<ReturnType<typeof rasterUpload>>) {
    return writeImage(imageDirectory(scope, 'products'), upload);
  }

  read(scope: Scope, key: string) {
    return readImage(imageDirectory(scope, 'products'), key);
  }

  async remove(scope: Scope, keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await removeImage(imageDirectory(scope, 'products'), key);
      } catch {
        this.logger.warn('Could not remove a retired product image');
      }
    }
  }
}
