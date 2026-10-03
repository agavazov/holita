import { Blob as NodeBlob } from 'node:buffer';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { createDataProvider, mediaResource } from '../data/data-provider.js';
import type { ReferenceEventMediaDetailsFragment } from '../generated/graphql/operations.js';
import { createPrototypeState, prototypeStorageKey } from './state.js';
import { createPrototypeHandlers } from './handlers.js';
import { inspectPrototypeImage } from './media-validation.js';
import type { PrototypeMediaStorage } from './media-storage.js';

class MemoryStorage {
  value: string | null = null;
  fail = false;
  getItem() {
    return this.value;
  }
  setItem(_key: string, value: string) {
    if (this.fail) throw new Error('Quota');
    this.value = value;
  }
}
class Images implements PrototypeMediaStorage {
  rows = new Map<string, Blob>();
  fail = false;
  get(id: string) {
    return Promise.resolve(this.rows.get(id));
  }
  put(id: string, blob: Blob) {
    if (this.fail) return Promise.reject(new Error('Quota'));
    this.rows.set(id, blob);
    return Promise.resolve();
  }
  remove(id: string) {
    this.rows.delete(id);
    return Promise.resolve();
  }
  prune(retained: string[]) {
    for (const id of this.rows.keys()) if (!retained.includes(id)) this.rows.delete(id);
    return Promise.resolve();
  }
}
const storeA = '10000000-0000-4000-8000-000000000001',
  storeB = '10000000-0000-4000-8000-000000000002';
const fixture = '60000000-0000-4000-8000-000000000001';
const endpoint = 'http://127.0.0.1/__prototype/graphql',
  server = setupServer(),
  provider = createDataProvider(endpoint);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAIAAACDRijCAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAIElEQVQ4jWMwjLtAFcQwapDhaBgZjqajuNEsEkd+OgAAcGAOn5aBl0EAAAAASUVORK5CYII=',
  'base64',
);
let storage: MemoryStorage,
  images: Images,
  state: ReturnType<typeof createPrototypeState>,
  eventId: string;
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterAll(() => {
  server.close();
});
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 24, height: 16, close: vi.fn() }),
  );
  storage = new MemoryStorage();
  images = new Images();
  state = createPrototypeState(storage, images);
  eventId = state.createEvent(storeA, {
    title: 'Gallery forum',
    code: 'GALLERY',
    format: 'ONLINE',
    meetingUrl: 'https://example.com/forum',
    startsAt: '2026-11-12T08:00:00Z',
    endsAt: '2026-11-12T16:00:00Z',
  }).id;
  server.resetHandlers(...createPrototypeHandlers(endpoint, state));
});
function intent(parent = eventId, name = 'forum.png') {
  return state.createUploadIntent(storeA, parent, {
    originalName: name,
    contentType: 'image/png',
    byteSize: png.length,
  });
}
async function uploaded(parent = eventId, name = 'forum.png') {
  const target = intent(parent, name);
  await state.uploadMedia(
    target.uploadId,
    new Request(new URL(target.uploadUrl, endpoint), {
      method: 'PUT',
      headers: Object.fromEntries(target.headers.map((header) => [header.name, header.value])),
      body: png,
    }),
  );
  return target;
}
function history() {
  return state.listEventHistory(storeA, { eventId, offset: 0, limit: 100 }).items;
}

describe('Prototype gallery persistence and lifecycle', () => {
  it('seeds local placeholder images in both stores and starts new events empty', () => {
    expect(state.listMedia(storeA, fixture)).toHaveLength(2);
    expect(state.listMedia(storeB, '60000000-0000-4000-8000-000000000101')).toHaveLength(2);
    expect(state.listMedia(storeA, eventId)).toEqual([]);
    expect(() => state.listMedia(storeB, fixture)).toThrow('Event not found');
  });
  it('keeps staged files out of persistence and finalizes exactly once, including after reload', async () => {
    const target = await uploaded();
    expect(images.rows.size).toBe(0);
    expect(state.listMedia(storeA, eventId)).toEqual([]);
    const first = await state.finalizeUpload(storeA, target.uploadId);
    expect(first.isCover).toBe(true);
    expect(images.rows.size).toBe(1);
    expect((await state.finalizeUpload(storeA, target.uploadId)).id).toBe(first.id);
    const reloaded = createPrototypeState(storage, images);
    expect((await reloaded.finalizeUpload(storeA, target.uploadId)).id).toBe(first.id);
    expect(history().filter((row) => row.operation === 'MEDIA_ADDED')).toHaveLength(1);
    expect(storage.value).not.toContain('data:image');
  });
  it('routes all seven generated media operations through the shared provider', async () => {
    if (!provider.custom) throw new Error('Missing custom provider');
    const resource = mediaResource(storeA, eventId);
    const created = await provider.custom<{ intent: ReturnType<typeof intent> }>({
      url: resource,
      method: 'post',
      payload: {
        action: 'intent',
        input: { originalName: 'http.png', contentType: 'image/png', byteSize: png.length },
      },
    });
    const target = created.data.intent;
    const response = await fetch(new URL(target.uploadUrl, endpoint), {
      method: target.method,
      headers: Object.fromEntries(target.headers.map((header) => [header.name, header.value])),
      body: png,
    });
    expect(response.status).toBe(204);
    const finalized = await provider.custom<{ image: ReferenceEventMediaDetailsFragment }>({
      url: resource,
      method: 'post',
      payload: { action: 'finalize', uploadId: target.uploadId },
    });
    const image = finalized.data.image;
    await provider.update({ resource, id: image.id, variables: { altText: 'Conference room' } });
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { action: 'cover', id: image.id },
    });
    await provider.custom({
      url: resource,
      method: 'post',
      payload: { action: 'reorder', ids: [image.id] },
    });
    expect(
      (await provider.getList<ReferenceEventMediaDetailsFragment>({ resource })).data[0]?.altText,
    ).toBe('Conference room');
    const read = await fetch(new URL(image.readUrl, endpoint));
    expect(read.status).toBe(200);
    expect(read.headers.get('cache-control')).toBe('no-store');
    expect(Buffer.from(await read.arrayBuffer())).toEqual(png);
    await provider.deleteOne({ resource, id: image.id });
    expect((await provider.getList({ resource })).data).toEqual([]);
    expect(images.rows.size).toBe(0);
  });
  it('preserves other changes made while the image store writes and suppresses reset uploads', async () => {
    const target = await uploaded();
    let release: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(images, 'put').mockImplementation(async (id, blob) => {
      await wait;
      images.rows.set(id, blob);
    });
    const finish = state.finalizeUpload(storeA, target.uploadId);
    state.updateEvent(storeA, eventId, { title: 'Changed during upload' });
    release?.();
    await finish;
    expect(state.getEvent(storeA, eventId).title).toBe('Changed during upload');
    const another = await uploaded();
    let releaseReset: (() => void) | undefined;
    const resetWait = new Promise<void>((resolve) => {
      releaseReset = resolve;
    });
    vi.spyOn(images, 'put').mockImplementation(async (id, blob) => {
      await resetWait;
      images.rows.set(id, blob);
    });
    const pending = state.finalizeUpload(storeA, another.uploadId);
    state.reset();
    releaseReset?.();
    await expect(pending).rejects.toThrow();
    expect(state.retainedMediaIds()).toEqual([]);
    await images.prune(state.retainedMediaIds());
    expect(images.rows.size).toBe(0);
  });
  it('fails binary and metadata writes without saving media or History and allows retry', async () => {
    const target = await uploaded(),
      before = storage.value;
    images.fail = true;
    await expect(state.finalizeUpload(storeA, target.uploadId)).rejects.toThrow('Quota');
    expect(storage.value).toBe(before);
    images.fail = false;
    storage.fail = true;
    await expect(state.finalizeUpload(storeA, target.uploadId)).rejects.toThrow(
      'could not be saved',
    );
    expect(storage.value).toBe(before);
    expect(images.rows.size).toBe(0);
    storage.fail = false;
    await state.finalizeUpload(storeA, target.uploadId);
    expect(history().filter((row) => row.operation === 'MEDIA_ADDED')).toHaveLength(1);
  });
  it('enforces complete ordering, one cover and atomic no-op-aware History', async () => {
    const first = await state.finalizeUpload(storeA, (await uploaded()).uploadId),
      second = await state.finalizeUpload(storeA, (await uploaded(eventId, 'second.png')).uploadId);
    expect(() => state.reorderMedia(storeA, eventId, [first.id])).toThrow('gallery changed');
    expect(() => state.reorderMedia(storeA, eventId, [first.id, first.id])).toThrow(
      'Do not repeat',
    );
    state.reorderMedia(storeA, eventId, [second.id, first.id]);
    state.setMediaCover(storeA, eventId, second.id);
    state.updateMedia(storeA, eventId, second.id, { altText: ' Room ' });
    const count = history().length;
    state.reorderMedia(storeA, eventId, [second.id, first.id]);
    state.setMediaCover(storeA, eventId, second.id);
    state.updateMedia(storeA, eventId, second.id, { altText: 'Room' });
    expect(history()).toHaveLength(count);
    const before = storage.value;
    storage.fail = true;
    expect(() => state.setMediaCover(storeA, eventId, first.id)).toThrow('could not be saved');
    expect(storage.value).toBe(before);
    storage.fail = false;
    await state.deleteMedia(storeA, eventId, second.id);
    expect(state.listMedia(storeA, eventId).map((row) => [row.id, row.isCover])).toEqual([
      [first.id, true],
    ]);
    expect(history().map((row) => row.operation)).toContain('MEDIA_REMOVED');
  });
  it('preserves bytes through Trash/Restore while refusing reads, mutations and finalize in Trash', async () => {
    const target = await uploaded(),
      image = await state.finalizeUpload(storeA, target.uploadId),
      url = new URL(image.readUrl, endpoint);
    state.trashEvents(storeA, [eventId]);
    expect(() => state.listMedia(storeA, eventId)).toThrow('Event not found');
    expect(() => state.updateMedia(storeA, eventId, image.id, { altText: null })).toThrow(
      'Event not found',
    );
    await expect(
      state.readMedia(storeA, image.id, url.searchParams.get('token'), url.origin),
    ).rejects.toThrow('Event not found');
    await expect(state.finalizeUpload(storeA, target.uploadId)).rejects.toThrow('Event not found');
    expect(images.rows.size).toBe(1);
    state.restoreEvents(storeA, [eventId]);
    expect(state.listMedia(storeA, eventId)[0]?.id).toBe(image.id);
    expect(
      await state.readMedia(storeA, image.id, url.searchParams.get('token'), url.origin),
    ).toBeDefined();
  });
  it('refuses foreign store/event IDs and invalid or expired image capabilities', async () => {
    const target = await uploaded(),
      image = await state.finalizeUpload(storeA, target.uploadId),
      url = new URL(image.readUrl, endpoint);
    await expect(state.finalizeUpload(storeB, target.uploadId)).rejects.toThrow('Upload not found');
    expect(() => state.setMediaCover(storeB, fixture, image.id)).toThrow();
    expect(() => state.updateMedia(storeA, fixture, image.id, { altText: null })).toThrow(
      'Image not found',
    );
    await expect(
      state.readMedia(storeB, image.id, url.searchParams.get('token'), url.origin),
    ).rejects.toThrow('invalid or expired');
    await expect(state.readMedia(storeA, image.id, 'wrong', url.origin)).rejects.toThrow(
      'invalid or expired',
    );
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    await expect(
      state.readMedia(storeA, image.id, url.searchParams.get('token'), url.origin),
    ).rejects.toThrow('invalid or expired');
  });
  it('counts pending slots, expires unused intents and limits finalized galleries to ten', async () => {
    const pending = Array.from({ length: 10 }, () => intent());
    expect(() => intent()).toThrow('at most 10');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60_000);
    expect(intent()).toBeDefined();
    await expect(state.finalizeUpload(storeA, pending[0]?.uploadId)).rejects.toThrow();
  });
  it('renews preview URLs before expiry while keeping earlier links valid until their deadline', async () => {
    const image = await state.finalizeUpload(storeA, (await uploaded()).uploadId),
      original = new URL(image.readUrl, endpoint),
      now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 8 * 60_000);
    const refreshed = state.listMedia(storeA, eventId)[0];
    if (!refreshed) throw new Error('Missing image');
    const renewed = new URL(refreshed.readUrl, endpoint);
    expect(Date.parse(refreshed.readUrlExpiresAt)).toBe(now + 18 * 60_000);
    expect(renewed.href).not.toBe(original.href);
    await expect(
      state.readMedia(storeA, image.id, original.searchParams.get('token'), original.origin),
    ).resolves.toBeDefined();
    clock.mockReturnValue(now + 11 * 60_000);
    await expect(
      state.readMedia(storeA, image.id, original.searchParams.get('token'), original.origin),
    ).rejects.toThrow('invalid or expired');
    await expect(
      state.readMedia(storeA, image.id, renewed.searchParams.get('token'), renewed.origin),
    ).resolves.toBeDefined();
  });
  it('updates the parent timestamp for cover changes while independent alt/order updates leave it intact', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime('2026-10-10T12:00:00Z');
      const first = await state.finalizeUpload(storeA, (await uploaded()).uploadId);
      expect(state.getEvent(storeA, eventId).updatedAt).toBe('2026-10-10T12:00:00.000Z');
      vi.setSystemTime('2026-10-11T12:00:00Z');
      const second = await state.finalizeUpload(
        storeA,
        (await uploaded(eventId, 'second.png')).uploadId,
      );
      expect(state.getEvent(storeA, eventId).updatedAt).toBe('2026-10-10T12:00:00.000Z');
      state.setMediaCover(storeA, eventId, second.id);
      expect(state.getEvent(storeA, eventId).updatedAt).toBe('2026-10-11T12:00:00.000Z');
      vi.setSystemTime('2026-10-12T12:00:00Z');
      state.updateMedia(storeA, eventId, second.id, { altText: 'Conference room' });
      state.reorderMedia(storeA, eventId, [second.id, first.id]);
      expect(state.getEvent(storeA, eventId).updatedAt).toBe('2026-10-11T12:00:00.000Z');
      await state.deleteMedia(storeA, eventId, second.id);
      expect(state.getEvent(storeA, eventId).updatedAt).toBe('2026-10-12T12:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });
  it('rejects reused upload capabilities and incomplete finalization', async () => {
    const target = intent();
    await expect(state.finalizeUpload(storeA, target.uploadId)).rejects.toThrow(
      'incomplete or expired',
    );
    await expect(
      state.uploadMedia(target.uploadId, new Request(endpoint, { method: 'PUT', body: png })),
    ).rejects.toThrow('Invalid upload');
    const used = await uploaded();
    await expect(
      state.uploadMedia(
        used.uploadId,
        new Request(endpoint, {
          method: 'PUT',
          headers: Object.fromEntries(used.headers.map((header) => [header.name, header.value])),
          body: png,
        }),
      ),
    ).rejects.toThrow('already been used');
  });
  it('limits finalized galleries as well as pending slots and frees a slot on removal', async () => {
    for (let index = 0; index < 10; index++)
      await state.finalizeUpload(
        storeA,
        (await uploaded(eventId, `image-${String(index)}.png`)).uploadId,
      );
    expect(() => intent()).toThrow('at most 10');
    const first = state.listMedia(storeA, eventId)[0];
    if (!first) throw new Error('Missing image');
    await state.deleteMedia(storeA, eventId, first.id);
    expect(intent()).toBeDefined();
  });
  it('replaces obsolete and corrupt media relationships rather than keeping invalid browser data', () => {
    const raw = storage.value;
    if (!raw) throw new Error('Missing snapshot');
    storage.setItem(prototypeStorageKey, raw.replace('"version":4', '"version":3'));
    expect(createPrototypeState(storage).listEvents(storeA, { offset: 0, limit: 100 }).total).toBe(
      22,
    );
    const current = storage.value;
    if (!current) throw new Error('Missing snapshot');
    storage.setItem(prototypeStorageKey, current.replace('"isCover":true', '"isCover":false'));
    expect(createPrototypeState(storage).listMedia(storeA, fixture)[0]?.isCover).toBe(true);
  });
  it.each([
    { originalName: '' },
    { contentType: 'image/svg+xml' },
    { byteSize: 0 },
    { byteSize: 5 * 1024 * 1024 + 1 },
  ])('validates intent metadata %j', (patch) => {
    expect(() =>
      state.createUploadIntent(storeA, eventId, {
        originalName: 'image.png',
        contentType: 'image/png',
        byteSize: 100,
        ...patch,
      }),
    ).toThrow();
  });
  it('validates alt text omission, Unicode length and clearing', () => {
    const row = state.listMedia(storeA, fixture)[0];
    if (!row) throw new Error('Missing fixture');
    expect(() => state.updateMedia(storeA, fixture, row.id, {})).toThrow('Provide alt text');
    expect(() =>
      state.updateMedia(storeA, fixture, row.id, { altText: '😀'.repeat(301) }),
    ).toThrow();
    expect(state.updateMedia(storeA, fixture, row.id, { altText: '  ' }).altText).toBeNull();
  });
});

describe('Browser image validation', () => {
  it('checks PNG chunks, MIME, truncation, animation and decoded pixel limits', async () => {
    await expect(inspectPrototypeImage(new Blob([png]), 'image/png')).resolves.toBeUndefined();
    await expect(inspectPrototypeImage(new Blob([png]), 'image/jpeg')).rejects.toThrow(
      'complete, still',
    );
    await expect(
      inspectPrototypeImage(new Blob([png.subarray(0, png.length - 4)]), 'image/png'),
    ).rejects.toThrow('complete, still');
    const animated = Buffer.from(png);
    animated.write('acTL', 37, 'ascii');
    await expect(inspectPrototypeImage(new Blob([animated]), 'image/png')).rejects.toThrow(
      'complete, still',
    );
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 5000, height: 5000, close: vi.fn() }),
    );
    await expect(inspectPrototypeImage(new Blob([png]), 'image/png')).rejects.toThrow(
      '20 megapixels',
    );
  });
});
