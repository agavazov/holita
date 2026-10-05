import { DataError } from '../data/data-error.js';
import type {
  CreateReferenceUploadInput,
  UpdateReferenceEventMediaInput,
  ReferenceEventMediaDetailsFragment,
  CreateReferenceUploadIntentMutation,
} from '../generated/graphql/operations.js';
import type { PrototypeMedia, PrototypePersistence, PrototypeSnapshot } from './snapshot.js';
import type { PrototypeMediaStorage } from './media-storage.js';
import { findEvent, writableEvent } from './events.js';
import { historyChanges, recordHistory } from './event-history.js';
import { ids, invalid, optionalText, text, uuid } from './validation.js';
import { inspectPrototypeImage, mediaContentTypes, mediaMaxBytes } from './media-validation.js';
import { prototypeMediaFixtures } from './media-fixtures.js';

type Intent = {
  storeId: string;
  eventId: string;
  id: string;
  fileKey: string;
  token: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  expires: number;
  finalizeExpires: number;
  state: 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FINALIZED' | 'FAILED';
  blob?: Blob;
};
const label = (row: PrototypeMedia | undefined) => (row ? `${row.originalName} (${row.id})` : null);
function ordered(snapshot: PrototypeSnapshot, storeId: string, eventId: string) {
  return snapshot.media
    .filter((row) => row.storeId === storeId && row.eventId === eventId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
function findMedia(snapshot: PrototypeSnapshot, storeId: string, eventId: string, id: unknown) {
  const recordId = uuid(id, 'id'),
    row = snapshot.media.find(
      (image) => image.storeId === storeId && image.eventId === eventId && image.id === recordId,
    );
  if (!row) throw new DataError('Image not found');
  return row;
}
export function createMediaState(
  { read, write }: PrototypePersistence,
  storage?: PrototypeMediaStorage,
) {
  const intents = new Map<string, Intent>();
  const links = new Map<string, { id: string; storeId: string; expires: number }>();
  function pruneIntents() {
    for (const [id, intent] of intents) {
      if (
        (intent.state === 'UPLOADED' ? intent.finalizeExpires : intent.expires) <= Date.now() ||
        intent.state === 'FAILED'
      )
        intents.delete(id);
    }
    for (const [id, link] of links) if (link.expires <= Date.now()) links.delete(id);
  }
  function result(row: PrototypeMedia): ReferenceEventMediaDetailsFragment {
    const token = crypto.randomUUID(),
      expires = Date.now() + 10 * 60_000;
    // Refresh extends preview lifetime while earlier capabilities keep their own expiry.
    links.set(token, { id: row.id, storeId: row.storeId, expires });
    return {
      id: row.id,
      eventId: row.eventId,
      originalName: row.originalName,
      contentType: row.contentType,
      byteSize: row.byteSize,
      altText: row.altText,
      position: row.position,
      isCover: row.isCover,
      createdAt: row.createdAt,
      readUrl: `/__prototype/media/files/${row.storeId}/${row.id}?token=${token}`,
      readUrlExpiresAt: new Date(expires).toISOString(),
    };
  }
  function imageStorage() {
    if (!storage) throw new DataError('Prototype image storage is unavailable. Reload and retry.');
    return storage;
  }
  return {
    resetMedia: () => {
      intents.clear();
      links.clear();
    },
    retainedMediaIds: () =>
      read()
        .media.filter((row) => row.fixture === null)
        .map((row) => row.id),
    listMedia: (storeValue: unknown, parent: unknown) => {
      pruneIntents();
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = findEvent(snapshot, storeId, parent);
      return ordered(snapshot, storeId, event.id).map(result);
    },
    createUploadIntent: (
      storeValue: unknown,
      parent: unknown,
      input: CreateReferenceUploadInput,
    ): CreateReferenceUploadIntentMutation['createReferenceUploadIntent'] => {
      pruneIntents();
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, parent);
      const originalName = text(input.originalName, 'originalName', 255);
      if (!mediaContentTypes.includes(input.contentType))
        invalid('contentType', 'Choose a JPEG, PNG or WebP image.');
      if (!Number.isInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > mediaMaxBytes)
        invalid('byteSize', 'Choose an image of at most 5 MiB.');
      if (
        ordered(snapshot, storeId, event.id).length +
          [...intents.values()].filter(
            (intent) =>
              intent.storeId === storeId &&
              intent.eventId === event.id &&
              intent.state !== 'FINALIZED',
          ).length >=
        10
      )
        throw new DataError('An event can have at most 10 images, including pending uploads.');
      const intent: Intent = {
        storeId,
        eventId: event.id,
        id: crypto.randomUUID(),
        fileKey: crypto.randomUUID(),
        token: crypto.randomUUID(),
        originalName,
        contentType: input.contentType,
        byteSize: input.byteSize,
        state: 'PENDING',
        expires: Date.now() + 10 * 60_000,
        finalizeExpires: Date.now() + 60 * 60_000,
      };
      intents.set(intent.id, intent);
      return {
        uploadId: intent.id,
        fileKey: intent.fileKey,
        uploadUrl: `/__prototype/media/uploads/${intent.id}`,
        method: 'PUT',
        headers: [
          { name: 'authorization', value: `Bearer ${intent.token}` },
          { name: 'content-type', value: intent.contentType },
        ],
        expiresAt: new Date(intent.expires).toISOString(),
      };
    },
    uploadMedia: async (id: unknown, request: Request) => {
      const intent = intents.get(uuid(id, 'uploadId'));
      if (!intent || request.headers.get('authorization') !== `Bearer ${intent.token}`)
        throw new DataError('Invalid upload capability.');
      findEvent(read(), intent.storeId, intent.eventId);
      if (intent.state !== 'PENDING' || intent.expires <= Date.now())
        throw new DataError(
          'This upload is expired or has already been used. Create a new intent.',
        );
      intent.state = 'UPLOADING';
      try {
        if (request.headers.get('content-type') !== intent.contentType)
          throw new DataError('The upload content type does not match its intent.');
        const blob = await request.blob();
        if (blob.size !== intent.byteSize)
          throw new DataError('The upload size does not match its intent.');
        await inspectPrototypeImage(blob, intent.contentType);
        request.signal.throwIfAborted();
        findEvent(read(), intent.storeId, intent.eventId);
        if (intents.get(intent.id) !== intent)
          throw new DataError('Upload was reset. Create a new intent.');
        intent.blob = blob;
        intent.state = 'UPLOADED';
      } catch (error) {
        intent.state = 'FAILED';
        throw error;
      }
    },
    finalizeUpload: async (storeValue: unknown, uploadValue: unknown) => {
      const storeId = uuid(storeValue, 'x-store-id'),
        id = uuid(uploadValue, 'uploadId');
      const snapshot = read(),
        existing = snapshot.media.find((row) => row.storeId === storeId && row.uploadId === id);
      if (existing) {
        writableEvent(snapshot, storeId, existing.eventId);
        return result(existing);
      }
      const intent = intents.get(id);
      if (!intent || intent.storeId !== storeId) throw new DataError('Upload not found');
      writableEvent(snapshot, storeId, intent.eventId);
      if (intent.state !== 'UPLOADED' || !intent.blob || intent.finalizeExpires <= Date.now())
        throw new DataError('Upload is incomplete or expired. Upload the image again.');
      const images = imageStorage();
      await images.put(intent.fileKey, intent.blob);
      try {
        // Re-read after the async write: another mutation may have changed this event.
        const snapshot = read();
        const event = writableEvent(snapshot, storeId, intent.eventId);
        if (intents.get(id) !== intent)
          throw new DataError('Upload was reset. Create a new intent.');
        const duplicate = snapshot.media.find(
          (row) => row.storeId === storeId && row.uploadId === id,
        );
        if (duplicate) return result(duplicate);
        const rows = ordered(snapshot, storeId, intent.eventId);
        if (rows.length >= 10) throw new DataError('An event can have at most 10 images.');
        const row: PrototypeMedia = {
          id: intent.fileKey,
          storeId,
          eventId: intent.eventId,
          uploadId: id,
          fixture: null,
          originalName: intent.originalName,
          contentType: intent.contentType,
          byteSize: intent.byteSize,
          altText: null,
          position: (rows.at(-1)?.position ?? -1) + 1,
          isCover: !rows.length,
          createdAt: new Date().toISOString(),
        };
        snapshot.media.push(row);
        if (row.isCover) event.updatedAt = row.createdAt;
        recordHistory(
          snapshot,
          storeId,
          row.eventId,
          'MEDIA_ADDED',
          row.isCover ? historyChanges({ cover: null }, { cover: label(row) }) : [],
          row.originalName,
        );
        write(snapshot);
        intent.state = 'FINALIZED';
        delete intent.blob;
        return result(row);
      } catch (error) {
        // Metadata is authoritative. Failed cleanup is retried at startup/Reset.
        try {
          if (!read().media.some((row) => row.id === intent.fileKey))
            await images.remove(intent.fileKey);
        } catch {
          // Startup retries cleanup of unreferenced bytes.
        }
        throw error;
      }
    },
    updateMedia: (
      storeValue: unknown,
      parent: unknown,
      imageId: unknown,
      input: UpdateReferenceEventMediaInput,
    ) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, parent),
        row = findMedia(snapshot, storeId, event.id, imageId);
      if (input.altText === undefined)
        throw new DataError('Provide alt text, or null to clear it.');
      const altText = optionalText(input.altText, 'altText', 300),
        changes = historyChanges({ altText: row.altText ?? null }, { altText });
      row.altText = altText;
      if (changes.length)
        recordHistory(snapshot, storeId, event.id, 'MEDIA_UPDATED', changes, row.originalName);
      write(snapshot);
      return result(row);
    },
    setMediaCover: (storeValue: unknown, parent: unknown, imageId: unknown) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, parent),
        selected = findMedia(snapshot, storeId, event.id, imageId),
        rows = ordered(snapshot, storeId, event.id);
      const previous = rows.find((row) => row.isCover);
      event.updatedAt = new Date().toISOString();
      rows.forEach((row) => {
        row.isCover = row.id === selected.id;
      });
      if (previous?.id !== selected.id)
        recordHistory(
          snapshot,
          storeId,
          event.id,
          'COVER_CHANGED',
          historyChanges({ cover: label(previous) }, { cover: label(selected) }),
        );
      write(snapshot);
      return rows.map(result);
    },
    reorderMedia: (storeValue: unknown, parent: unknown, values: unknown) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, parent),
        selected = ids(values, 'ids'),
        rows = ordered(snapshot, storeId, event.id);
      if (rows.length !== selected.length || rows.some((row) => !selected.includes(row.id)))
        throw new DataError(
          'The gallery changed. Cancel the draft to reload it, then arrange it again.',
        );
      const before = rows.map(label).join(', ');
      rows.forEach((row) => {
        row.position = selected.indexOf(row.id);
      });
      rows.sort((a, b) => a.position - b.position);
      const changes = historyChanges(
        { galleryOrder: before },
        { galleryOrder: rows.map(label).join(', ') },
      );
      if (changes.length) recordHistory(snapshot, storeId, event.id, 'MEDIA_REORDERED', changes);
      write(snapshot);
      return rows.map(result);
    },
    deleteMedia: async (storeValue: unknown, parent: unknown, imageId: unknown) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, parent),
        row = findMedia(snapshot, storeId, event.id, imageId),
        rows = ordered(snapshot, storeId, event.id),
        next = rows.find((image) => image.id !== row.id);
      if (row.isCover && next) next.isCover = true;
      if (row.isCover) event.updatedAt = new Date().toISOString();
      snapshot.media = snapshot.media.filter((image) => image.id !== row.id);
      recordHistory(
        snapshot,
        storeId,
        event.id,
        'MEDIA_REMOVED',
        row.isCover ? historyChanges({ cover: label(row) }, { cover: label(next) }) : [],
        row.originalName,
      );
      write(snapshot);
      for (const [token, link] of links) if (link.id === row.id) links.delete(token);
      if (row.fixture === null)
        await imageStorage()
          .remove(row.id)
          .catch(() => undefined);
      return row.id;
    },
    readMedia: async (
      storeValue: unknown,
      imageId: unknown,
      token: string | null,
      origin: string,
    ) => {
      const storeId = uuid(storeValue, 'storeId'),
        id = uuid(imageId, 'id'),
        link = token ? links.get(token) : undefined;
      if (!link || link.id !== id || link.storeId !== storeId || link.expires <= Date.now())
        throw new DataError('Image link is invalid or expired. Refresh the gallery.');
      const snapshot = read(),
        row = snapshot.media.find((image) => image.storeId === storeId && image.id === id);
      if (!row) throw new DataError('Image not found');
      findEvent(snapshot, storeId, row.eventId);
      const blob =
        row.fixture === null
          ? await imageStorage().get(id)
          : await fetch(new URL(prototypeMediaFixtures[row.fixture].path, origin)).then(
              async (response) => {
                if (!response.ok) throw new DataError('Image file unavailable.');
                return response.blob();
              },
            );
      if (!blob) throw new DataError('Image file unavailable.');
      const current = read();
      findEvent(current, storeId, row.eventId);
      if (!current.media.some((image) => image.storeId === storeId && image.id === id))
        throw new DataError('Image not found');
      return blob;
    },
  };
}
