import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type {
  CreateReferenceUploadInput,
  ReferenceEventMedia,
  UpdateReferenceEventMediaInput,
} from '../generated/graphql/types.js';
import type { EventMedia, UploadIntent } from '../generated/prisma/client.js';
import type { RequestContext } from '../graphql/request-context.js';
import { EventHistoryRepository } from '../events/event-history.repository.js';
import { historyChanges } from '../events/event-history.js';
import { EventsRepository } from '../events/events.repository.js';
import { ids, invalid, optionalText, text, uuid } from '../validation.js';
import { LocalMediaStorage, mediaContentTypes, mediaMaxBytes } from './local-media-storage.js';
import { MediaStorage } from './media-storage.js';
import { MediaRepository } from './media.repository.js';

function imageLabel(row: EventMedia | undefined): string | null {
  return row ? `${row.originalName} (${row.id})` : null;
}

@Injectable()
export class MediaService {
  private readonly activeUploads = new Set<string>();
  private readonly logger = new Logger(MediaService.name);
  constructor(
    private readonly media: MediaRepository,
    private readonly events: EventsRepository,
    private readonly storage: MediaStorage,
    private readonly local: LocalMediaStorage,
    private readonly history: EventHistoryRepository,
  ) {}

  private result(row: EventMedia, coverId: string | null): ReferenceEventMedia {
    return { ...row, isCover: row.id === coverId, ...this.storage.readTarget(row) };
  }
  async list(context: RequestContext, parent: string) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parent, 'eventId');
    const event = await this.events.find(storeId, eventId);
    if (!event) throw new NotFoundException('Event not found');
    return (await this.media.list(storeId, eventId)).map((row) =>
      this.result(row, event.coverMediaId),
    );
  }
  async createIntent(context: RequestContext, parent: string, input: CreateReferenceUploadInput) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parent, 'eventId');
    const originalName = text(input.originalName, 'originalName', 255);
    if (!mediaContentTypes.includes(input.contentType))
      invalid('contentType', 'Choose a JPEG, PNG or WebP image.');
    if (!Number.isInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > mediaMaxBytes)
      invalid('byteSize', 'Choose an image of at most 5 MiB.');
    const token = randomBytes(32).toString('base64url');
    const intent = await this.events.withLockedEvent(storeId, eventId, async (_event, tx) => {
      const rows = await this.media.list(storeId, eventId, tx);
      if (rows.length + (await this.media.pending(tx, storeId, eventId)) >= 10)
        throw new ConflictException(
          'An event can have at most 10 images, including pending uploads.',
        );
      return this.media.createIntent(tx, {
        storeId,
        eventId,
        originalName,
        contentType: input.contentType,
        byteSize: input.byteSize,
        fileKey: randomUUID(),
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        finalizeExpiresAt: new Date(Date.now() + 60 * 60_000),
      });
    });
    return {
      uploadId: intent.id,
      fileKey: intent.fileKey,
      ...this.storage.uploadTarget(intent, token),
    };
  }
  async upload(id: string, authorization: string | undefined, request: IncomingMessage) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException('Invalid upload capability.');
    const intent = await this.media.uploadCapability(
      uuid(id, 'uploadId'),
      createHash('sha256').update(token).digest('hex'),
    );
    if (!intent) throw new NotFoundException('Upload not found.');
    if (this.activeUploads.has(intent.id))
      throw new ConflictException('This upload is already in progress.');
    this.activeUploads.add(intent.id);
    let claimed = false;
    const timer = setTimeout(() => {
      request.destroy(new Error('Upload timed out.'));
    }, 120_000);
    timer.unref();
    try {
      if (!(await this.media.claimUpload(intent.storeId, intent.id)).count)
        throw new ConflictException(
          'This upload is expired or has already been used. Create a new intent.',
        );
      claimed = true;
      await this.local.write(intent, request);
      if (!(await this.media.finishUpload(intent.storeId, intent.id)).count)
        throw new ConflictException('Upload could not be completed. Create a new intent.');
    } catch (error) {
      request.resume();
      if (claimed) {
        try {
          if ((await this.media.finishUpload(intent.storeId, intent.id, true)).count)
            await this.dispose(intent);
        } catch {
          this.logger.warn('Upload cleanup deferred; the persisted intent will be retried.');
        }
      }
      throw error;
    } finally {
      clearTimeout(timer);
      this.activeUploads.delete(intent.id);
    }
  }
  async finalize(context: RequestContext, uploadId: string) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      id = uuid(uploadId, 'uploadId');
    const original = await this.media.intent(storeId, id);
    if (!original) throw new NotFoundException('Upload not found');
    return this.events.withLockedEvent(storeId, original.eventId, async (event, tx) => {
      const intent = await this.media.intent(storeId, id, tx);
      if (!intent) throw new NotFoundException('Upload not found');
      const rows = await this.media.list(storeId, intent.eventId, tx);
      const existing = rows.find((row) => row.uploadId === intent.id);
      if (existing) return this.result(existing, event.coverMediaId);
      if (rows.length >= 10) throw new ConflictException('An event can have at most 10 images.');
      // This conditional update locks the intent against cleanup until the metadata commits.
      if (!(await this.media.claimFinalize(tx, storeId, id)).count)
        throw new ConflictException('Upload is incomplete or expired. Upload the image again.');
      await this.storage.verify(intent.fileKey, intent.byteSize, intent.contentType);
      const row = await this.media.createMedia(tx, {
        storeId,
        eventId: intent.eventId,
        uploadId: id,
        fileKey: intent.fileKey,
        originalName: intent.originalName,
        contentType: intent.contentType,
        byteSize: intent.byteSize,
        position: (rows.at(-1)?.position ?? -1) + 1,
      });
      if (!event.coverMediaId) await this.media.cover(tx, storeId, intent.eventId, row.id);
      await this.history.record(
        tx,
        storeId,
        intent.eventId,
        'MEDIA_ADDED',
        event.coverMediaId ? [] : historyChanges({ cover: null }, { cover: imageLabel(row) }),
        row.originalName,
      );
      return this.result(row, event.coverMediaId ?? row.id);
    });
  }
  async update(
    context: RequestContext,
    parent: string,
    mediaId: string,
    input: UpdateReferenceEventMediaInput,
  ) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parent, 'eventId'),
      id = uuid(mediaId, 'id');
    if (input.altText === undefined)
      throw new BadRequestException('Provide alt text, or null to clear it.');
    const altText = optionalText(input.altText, 'altText', 300);
    return this.events.withLockedEvent(storeId, eventId, async (event, tx) => {
      const row = await this.media.find(storeId, id, tx);
      if (!row || row.eventId !== eventId) throw new NotFoundException('Image not found');
      const updated = await this.media.update(tx, storeId, eventId, id, altText);
      const changes = historyChanges({ altText: row.altText }, { altText });
      if (changes.length)
        await this.history.record(tx, storeId, eventId, 'MEDIA_UPDATED', changes, row.originalName);
      return this.result(updated, event.coverMediaId);
    });
  }
  async cover(context: RequestContext, parent: string, mediaId: string) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parent, 'eventId'),
      id = uuid(mediaId, 'id');
    return this.events.withLockedEvent(storeId, eventId, async (event, tx) => {
      const rows = await this.media.list(storeId, eventId, tx);
      if (!rows.some((row) => row.id === id)) throw new NotFoundException('Image not found');
      await this.media.cover(tx, storeId, eventId, id);
      if (event.coverMediaId !== id)
        await this.history.record(
          tx,
          storeId,
          eventId,
          'COVER_CHANGED',
          historyChanges(
            { cover: imageLabel(rows.find((row) => row.id === event.coverMediaId)) },
            { cover: imageLabel(rows.find((row) => row.id === id)) },
          ),
        );
      return rows.map((row) => this.result(row, id));
    });
  }
  async reorder(context: RequestContext, parent: string, value: string[]) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parent, 'eventId'),
      ordered = ids(value, 'ids');
    return this.events.withLockedEvent(storeId, eventId, async (event, tx) => {
      const rows = await this.media.list(storeId, eventId, tx);
      if (rows.length !== ordered.length || rows.some((row) => !ordered.includes(row.id)))
        throw new ConflictException(
          'The gallery changed. Cancel the draft to reload it, then arrange it again.',
        );
      const updated = await this.media.reorder(tx, storeId, eventId, ordered);
      const order = (items: EventMedia[]) =>
        items.map((row) => `${row.originalName} (${row.id})`).join(', ');
      const changes = historyChanges(
        { galleryOrder: order(rows) },
        { galleryOrder: order(updated) },
      );
      if (changes.length)
        await this.history.record(tx, storeId, eventId, 'MEDIA_REORDERED', changes);
      return updated.map((row) => this.result(row, event.coverMediaId));
    });
  }
  async delete(context: RequestContext, parent: string, mediaId: string) {
    const storeId = uuid(context.storeId, 'x-store-id'),
      eventId = uuid(parent, 'eventId'),
      id = uuid(mediaId, 'id');
    const removed = await this.events.withLockedEvent(storeId, eventId, async (event, tx) => {
      const rows = await this.media.list(storeId, eventId, tx),
        row = rows.find((item) => item.id === id);
      if (!row) throw new NotFoundException('Image not found');
      if (event.coverMediaId === id)
        await this.media.cover(
          tx,
          storeId,
          eventId,
          rows.find((item) => item.id !== id)?.id ?? null,
        );
      await this.media.remove(tx, storeId, eventId, id, row.uploadId);
      await this.history.record(
        tx,
        storeId,
        eventId,
        'MEDIA_REMOVED',
        event.coverMediaId === id
          ? historyChanges(
              { cover: imageLabel(row) },
              { cover: imageLabel(rows.find((item) => item.id !== id)) },
            )
          : [],
        row.originalName,
      );
      return row;
    });
    await this.dispose({ id: removed.uploadId, storeId, fileKey: removed.fileKey });
    return id;
  }
  async read(store: string, mediaId: string, expires: unknown, signature: unknown) {
    const storeId = uuid(store, 'storeId'),
      id = uuid(mediaId, 'id');
    this.local.checkRead(storeId, id, expires, signature);
    const row = await this.media.find(storeId, id);
    if (!row) throw new NotFoundException('Image not found');
    return {
      stream: await this.local.open(row.fileKey),
      contentType: row.contentType,
      byteSize: row.byteSize,
    };
  }
  private async dispose(intent: Pick<UploadIntent, 'id' | 'storeId' | 'fileKey'>) {
    try {
      await this.storage.remove(intent.fileKey);
      await this.media.forget(intent.storeId, intent.id);
    } catch {
      this.logger.warn('Media deletion deferred; its persisted storage key will be retried.');
    }
  }
  async cleanup() {
    for (const intent of await this.media.cleanupCandidates([...this.activeUploads])) {
      if (
        !this.activeUploads.has(intent.id) &&
        (await this.media.claimCleanup(intent.storeId, intent.id)).count
      )
        await this.dispose(intent);
    }
  }
}
