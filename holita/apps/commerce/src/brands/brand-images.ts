import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { GraphQLError } from 'graphql';
import type { Scope } from '../scope.js';

const maxBytes = 5 * 1024 * 1024;
const mimeTypes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

function imageExtension(bytes: Buffer): keyof typeof mimeTypes | null {
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
    bytes.toString('ascii', 12, 16) === 'IHDR'
  ) {
    return 'png';
  }
  if (
    bytes.length >= 5 &&
    bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) &&
    bytes.readUInt16BE(bytes.length - 2) === 0xffd9
  ) {
    return 'jpg';
  }
  if (
    bytes.length >= 20 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.readUInt32LE(4) === bytes.length - 8 &&
    bytes.toString('ascii', 8, 12) === 'WEBP' &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))
  ) {
    return 'webp';
  }
  return null;
}

export function brandInputError(path: string, code: string, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors: [{ path, code, message }] },
  });
}

export function brandLogoUrl(row: Scope & { logoKey: string | null }): string | null {
  return row.logoKey ? `/media/brands/${row.branchId}/${row.logoKey}` : null;
}

export function brandImageType(key: string): string | undefined {
  const extension = keyPattern.exec(key)?.[1];
  return extension === 'jpg' || extension === 'png' || extension === 'webp'
    ? mimeTypes[extension]
    : undefined;
}

@Injectable()
export class BrandImages {
  private readonly logger = new Logger(BrandImages.name);

  private directory(scope: Scope): string {
    const root = process.env.HOLITA_COMMERCE_IMAGE_DIR;
    if (!root || !isAbsolute(root)) {
      throw new ServiceUnavailableException('Commerce image storage is unavailable');
    }
    return join(root, scope.tenantId, scope.branchId);
  }

  async write(scope: Scope, encoded: string): Promise<string> {
    if (encoded.length > Math.ceil(maxBytes / 3) * 4) {
      throw brandInputError('logo', 'INVALID_LOGO', 'The file exceeds 5 MiB');
    }
    const bytes = Buffer.from(encoded, 'base64');
    const extension =
      bytes.length <= maxBytes && bytes.toString('base64') === encoded
        ? imageExtension(bytes)
        : null;
    if (!extension) {
      throw brandInputError('logo', 'INVALID_LOGO', 'Choose a JPEG, PNG or WebP image up to 5 MiB');
    }
    const directory = this.directory(scope);
    const key = `${randomUUID()}.${extension}`;
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, key), bytes, { flag: 'wx' });
    return key;
  }

  read(scope: Scope, key: string): Promise<Buffer> {
    return readFile(join(this.directory(scope), key));
  }

  async remove(scope: Scope, key: string | null): Promise<void> {
    if (key) {
      try {
        await rm(join(this.directory(scope), key), { force: true });
      } catch {
        this.logger.warn('Could not remove a retired brand image');
      }
    }
  }
}
