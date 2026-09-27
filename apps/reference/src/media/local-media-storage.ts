import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, link, unlink, stat, rm } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { EventMedia, UploadIntent } from '../generated/prisma/client.js';
import { MediaStorage } from './media-storage.js';

export const mediaMaxBytes = 5 * 1024 * 1024;
export const mediaContentTypes = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class LocalMediaStorage extends MediaStorage {
  private readonly root = resolve(
    process.env.REFERENCE_MEDIA_ROOT ?? fileURLToPath(new URL('../../.media', import.meta.url)),
  );
  private readonly signingKey = randomBytes(32);
  private readonly publicUrl: string;

  constructor() {
    super();
    const url = new URL(
      process.env.REFERENCE_PUBLIC_URL ?? `http://127.0.0.1:${process.env.PORT ?? '11086'}`,
    );
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        'REFERENCE_PUBLIC_URL must be an http(s) base URL without credentials, query or fragment.',
      );
    this.publicUrl = url.toString().replace(/\/$/, '');
  }
  private path(fileKey: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(fileKey))
      throw new BadRequestException('Invalid storage key.');
    return join(this.root, fileKey);
  }
  uploadTarget(intent: UploadIntent, token: string) {
    return {
      uploadUrl: `${this.publicUrl}/media/uploads/${intent.id}`,
      method: 'PUT',
      headers: [
        { name: 'authorization', value: `Bearer ${token}` },
        { name: 'content-type', value: intent.contentType },
      ],
      expiresAt: intent.expiresAt,
    };
  }
  readTarget(media: EventMedia) {
    const expires = Date.now() + 10 * 60_000;
    const signature = this.sign(media.storeId, media.id, expires);
    return {
      readUrl: `${this.publicUrl}/media/files/${media.storeId}/${media.id}?expires=${String(expires)}&signature=${signature}`,
      readUrlExpiresAt: new Date(expires),
    };
  }
  private sign(storeId: string, id: string, expires: number) {
    return createHmac('sha256', this.signingKey)
      .update(`${storeId}:${id}:${String(expires)}`)
      .digest('hex');
  }
  checkRead(storeId: string, id: string, expires: unknown, signature: unknown) {
    if (typeof expires !== 'string' || typeof signature !== 'string')
      throw new NotFoundException('Invalid image link.');
    const time = Number(expires);
    if (
      !Number.isSafeInteger(time) ||
      time <= Date.now() ||
      !/^[0-9a-f]{64}$/.test(signature) ||
      !timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(this.sign(storeId, id, time), 'hex'),
      )
    )
      throw new NotFoundException('Image link is invalid or expired. Refresh the gallery.');
  }
  async write(intent: UploadIntent, request: IncomingMessage) {
    if (request.headers['content-type'] !== intent.contentType)
      throw new BadRequestException('The upload content type does not match its intent.');
    const length = request.headers['content-length'];
    if (length !== undefined && Number(length) !== intent.byteSize)
      throw new BadRequestException('The upload size does not match its intent.');
    const final = this.path(intent.fileKey),
      partial = `${final}.part`;
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const file = await open(partial, 'wx', 0o600);
    let bytes = 0;
    try {
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        if (!Buffer.isBuffer(chunk)) throw new BadRequestException('Expected binary image data.');
        bytes += chunk.byteLength;
        if (bytes > intent.byteSize || bytes > mediaMaxBytes)
          throw new PayloadTooLargeException('Image exceeds its declared size.');
        await file.writeFile(chunk);
      }
      if (bytes !== intent.byteSize) throw new BadRequestException('The upload is incomplete.');
    } finally {
      await file.close();
    }
    await this.inspect(partial, intent.byteSize, intent.contentType);
    // Creating a hard link is atomic and refuses replacement; finalized bytes stay immutable.
    await link(partial, final);
    await unlink(partial);
  }
  async verify(fileKey: string, byteSize: number, contentType: string) {
    await this.inspect(this.path(fileKey), byteSize, contentType);
  }
  private async inspect(path: string, byteSize: number, contentType: string) {
    try {
      if ((await stat(path)).size !== byteSize) throw new Error('Size mismatch');
      const image = sharp(path, { limitInputPixels: 20_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      const types: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      if (types[metadata.format] !== contentType || (metadata.pages ?? 1) !== 1)
        throw new Error('Type mismatch');
      await image.stats();
    } catch {
      throw new BadRequestException(
        'Upload a complete, still JPEG, PNG or WebP image of at most 20 megapixels.',
      );
    }
  }
  async open(fileKey: string) {
    try {
      const file = await open(this.path(fileKey), constants.O_RDONLY | constants.O_NOFOLLOW);
      return file.createReadStream();
    } catch {
      throw new NotFoundException('Image file unavailable.');
    }
  }
  async remove(fileKey: string) {
    const path = this.path(fileKey);
    await rm(`${path}.part`, { force: true });
    await rm(path, { force: true });
  }
}
