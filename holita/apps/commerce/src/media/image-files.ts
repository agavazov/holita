import { ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { Scope } from '../scope.js';

export const maxImageBytes = 5 * 1024 * 1024;
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

export function imageType(key: string): string | undefined {
  const extension = keyPattern.exec(key)?.[1];
  return extension === 'jpg' || extension === 'png' || extension === 'webp'
    ? mimeTypes[extension]
    : undefined;
}

export function rasterUpload(encoded: string) {
  if (encoded.length > Math.ceil(maxImageBytes / 3) * 4) {
    return null;
  }
  const bytes = Buffer.from(encoded, 'base64');
  const extension =
    bytes.length <= maxImageBytes && bytes.toString('base64') === encoded
      ? imageExtension(bytes)
      : null;
  return extension ? { bytes, extension } : null;
}

export function imageDirectory(scope: Scope, ...segments: string[]): string {
  const root = process.env.HOLITA_COMMERCE_IMAGE_DIR;
  if (!root || !isAbsolute(root)) {
    throw new ServiceUnavailableException('Commerce image storage is unavailable');
  }
  return join(root, scope.tenantId, scope.branchId, ...segments);
}

export async function writeImage(
  directory: string,
  { bytes, extension }: NonNullable<ReturnType<typeof rasterUpload>>,
) {
  const key = `${randomUUID()}.${extension}`;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, key), bytes, { flag: 'wx' });
  return key;
}

export function readImage(directory: string, key: string) {
  return readFile(join(directory, key));
}

export function removeImage(directory: string, key: string) {
  return rm(join(directory, key), { force: true });
}
