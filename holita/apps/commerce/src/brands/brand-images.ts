import { Injectable, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { Scope } from '../scope.js';
import {
  imageDirectory,
  maxImageBytes,
  rasterUpload,
  readImage,
  removeImage,
  writeImage,
} from '../media/image-files.js';

export function brandInputError(path: string, code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

export function brandLogoUrl(row: Scope & { logoKey: string | null }): string | null {
  return row.logoKey ? `/media/brands/${row.branchId}/${row.logoKey}` : null;
}

@Injectable()
export class BrandImages {
  private readonly logger = new Logger(BrandImages.name);

  async write(scope: Scope, encoded: string): Promise<string> {
    if (encoded.length > Math.ceil(maxImageBytes / 3) * 4) {
      throw brandInputError('logo', 'INVALID_LOGO', 'The file exceeds 5 MiB');
    }
    const upload = rasterUpload(encoded);
    if (!upload) {
      throw brandInputError('logo', 'INVALID_LOGO', 'Choose a JPEG, PNG or WebP image up to 5 MiB');
    }
    return writeImage(imageDirectory(scope), upload);
  }

  read(scope: Scope, key: string): Promise<Buffer> {
    return readImage(imageDirectory(scope), key);
  }

  async remove(scope: Scope, key: string | null): Promise<void> {
    if (key) {
      try {
        await removeImage(imageDirectory(scope), key);
      } catch {
        this.logger.warn('Could not remove a retired brand image');
      }
    }
  }
}
