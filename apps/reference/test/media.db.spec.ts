import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MediaCleanup } from '../src/media/media.cleanup.js';
import { MediaService } from '../src/media/media.service.js';
import { LocalMediaStorage } from '../src/media/local-media-storage.js';
import { createTestDatabase } from './test-database.js';

const fields = 'id eventId altText position isCover readUrl readUrlExpiresAt';
const create =
  'mutation($eventId:ID!,$input:CreateReferenceUploadInput!){createReferenceUploadIntent(eventId:$eventId,input:$input){uploadId fileKey uploadUrl method headers{name value} expiresAt}}';
const finalize = `mutation($uploadId:ID!){finalizeReferenceUpload(uploadId:$uploadId){${fields}}}`;
const list = `query($eventId:ID!){referenceEventMedia(eventId:$eventId){${fields}}}`;
const cover = `mutation($eventId:ID!,$id:ID!){setReferenceEventCover(eventId:$eventId,id:$id){${fields}}}`;
const reorder = `mutation($eventId:ID!,$ids:[ID!]!){reorderReferenceEventMedia(eventId:$eventId,ids:$ids){${fields}}}`;
const remove = 'mutation($eventId:ID!,$id:ID!){deleteReferenceEventMedia(eventId:$eventId,id:$id)}';
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object');
  return Object.fromEntries(Object.entries(value));
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string');
  return value;
}
function result(body: unknown, field: string) {
  expect(body).not.toHaveProperty('errors');
  return object(object(body).data)[field];
}
describe('Reference direct media with PostgreSQL and private files', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let closeDatabase: (() => Promise<void>) | undefined;
  let app: INestApplication | undefined;
  let storage: LocalMediaStorage;
  let media: MediaService;
  let root: string;
  let base: string;
  let png: Buffer;
  const oldRoot = process.env.REFERENCE_MEDIA_ROOT,
    oldPublic = process.env.REFERENCE_PUBLIC_URL;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'holita-reference-media-'));
    database = await createTestDatabase();
    closeDatabase = database.close;
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing port');
    await new Promise<void>((resolve) =>
      server.close(() => {
        resolve();
      }),
    );
    base = `http://127.0.0.1:${String(address.port)}`;
    process.env.REFERENCE_MEDIA_ROOT = root;
    process.env.REFERENCE_PUBLIC_URL = base;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ client: database.client, schema: database.schema })
      .overrideProvider(MediaCleanup)
      .useValue({})
      .compile();
    storage = module.get(LocalMediaStorage);
    media = module.get(MediaService);
    app = module.createNestApplication({ logger: false });
    await app.listen(address.port, '127.0.0.1');
    png = await sharp({ create: { width: 24, height: 16, channels: 3, background: '#315ed0' } })
      .png()
      .toBuffer();
  });
  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        await closeDatabase?.();
      } finally {
        if (root) await rm(root, { recursive: true, force: true });
        if (oldRoot === undefined) delete process.env.REFERENCE_MEDIA_ROOT;
        else process.env.REFERENCE_MEDIA_ROOT = oldRoot;
        if (oldPublic === undefined) delete process.env.REFERENCE_PUBLIC_URL;
        else process.env.REFERENCE_PUBLIC_URL = oldPublic;
      }
    }
  });
  async function query(source: string, variables: Record<string, unknown>, storeId: string) {
    const response = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-store-id': storeId },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10_000),
    });
    const body: unknown = await response.json();
    return body;
  }
  function parent(storeId: string = randomUUID()) {
    return database.client.event.create({
      data: {
        storeId,
        title: 'Gallery event',
        code: randomUUID(),
        format: 'ONLINE',
        meetingUrl: 'https://example.com',
        startsAt: new Date('2026-11-01T09:00:00Z'),
        endsAt: new Date('2026-11-01T10:00:00Z'),
      },
    });
  }
  async function intent(
    event: { id: string; storeId: string },
    patch: Record<string, unknown> = {},
  ) {
    const value = object(
      result(
        await query(
          create,
          {
            eventId: event.id,
            input: {
              originalName: '../../outside.png',
              contentType: 'image/png',
              byteSize: png.length,
              ...patch,
            },
          },
          event.storeId,
        ),
        'createReferenceUploadIntent',
      ),
    );
    if (!Array.isArray(value.headers)) throw new Error('Missing upload headers');
    const headers = Object.fromEntries(
      value.headers.map((header: unknown) => {
        const item = object(header);
        return [string(item.name), string(item.value)];
      }),
    );
    return {
      uploadId: string(value.uploadId),
      fileKey: string(value.fileKey),
      url: string(value.uploadUrl),
      method: string(value.method),
      headers,
    };
  }
  async function put(target: Awaited<ReturnType<typeof intent>>, bytes = png) {
    return fetch(target.url, {
      method: target.method,
      headers: target.headers,
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(10_000),
    });
  }
  async function image(event: { id: string; storeId: string }) {
    const target = await intent(event);
    expect((await put(target)).status).toBe(204);
    const value = object(
      result(
        await query(finalize, { uploadId: target.uploadId }, event.storeId),
        'finalizeReferenceUpload',
      ),
    );
    return { ...target, id: string(value.id), readUrl: string(value.readUrl) };
  }
  it('uploads outside GraphQL, validates bytes, finalizes idempotently and provides expiring read capabilities', async () => {
    const event = await parent(),
      row = await image(event);
    expect(row.url).toBe(`${base}/media/uploads/${row.uploadId}`);
    expect(row.fileKey).toMatch(/^[0-9a-f-]{36}$/);
    const saved = await database.client.uploadIntent.findUniqueOrThrow({
      where: { id: row.uploadId },
    });
    expect(saved.tokenHash).not.toBe(row.headers.authorization?.slice(7));
    expect(saved.state).toBe('FINALIZED');
    expect(await readFile(join(root, row.fileKey))).toEqual(png);
    expect(await database.client.eventHistory.count({ where: { eventId: event.id } })).toBe(1);
    expect(await query(finalize, { uploadId: row.uploadId }, event.storeId)).toMatchObject({
      data: { finalizeReferenceUpload: { id: row.id, isCover: true } },
    });
    expect(await database.client.eventMedia.count({ where: { eventId: event.id } })).toBe(1);
    const response = await fetch(row.readUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    const tampered = new URL(row.readUrl);
    tampered.searchParams.set('expires', String(Date.now() - 1));
    expect((await fetch(tampered)).status).toBe(404);
    expect((await fetch(`${base}/media/files/${event.storeId}/${row.id}`)).status).toBe(404);
    expect((await fetch(`${base}/.media/${row.fileKey}`)).status).toBe(404);
    expect((await put(row)).status).toBe(409);
    await expect(storage.remove('../outside')).rejects.toThrow('Invalid storage key');
  });
  it('enforces store and event ownership across intent, finalize, alt, cover, order and deletion', async () => {
    const event = await parent(),
      foreign = await parent(),
      sibling = await parent(event.storeId),
      row = await image(event);
    const pending = await intent(event);
    expect(
      await query(
        create,
        {
          eventId: event.id,
          input: { originalName: 'x', contentType: 'image/png', byteSize: png.length },
        },
        foreign.storeId,
      ),
    ).toHaveProperty('errors');
    expect(await query(list, { eventId: event.id }, foreign.storeId)).toHaveProperty('errors');
    expect(await query(finalize, { uploadId: pending.uploadId }, foreign.storeId)).toHaveProperty(
      'errors',
    );
    for (const source of [
      cover,
      remove,
      `mutation($eventId:ID!,$id:ID!){updateReferenceEventMedia(eventId:$eventId,id:$id,input:{altText:"wrong"}){id}}`,
    ]) {
      expect(
        await query(source, { eventId: sibling.id, id: row.id }, event.storeId),
      ).toHaveProperty('errors');
      expect(
        await query(source, { eventId: event.id, id: row.id }, foreign.storeId),
      ).toHaveProperty('errors');
    }
    expect(
      await query(reorder, { eventId: sibling.id, ids: [row.id] }, event.storeId),
    ).toHaveProperty('errors');
    await expect(
      database.client.event.update({ where: { id: sibling.id }, data: { coverMediaId: row.id } }),
    ).rejects.toThrow();
    const wrongStoreRead = row.readUrl.replace(event.storeId, foreign.storeId);
    expect((await fetch(wrongStoreRead)).status).toBe(404);
    const wrongToken = {
      ...pending,
      headers: { ...pending.headers, authorization: `Bearer ${'a'.repeat(43)}` },
    };
    expect((await put(wrongToken)).status).toBe(404);
  });
  it('saves alt text, complete ordering and cover independently, and reassigns a removed cover', async () => {
    const event = await parent(),
      a = await image(event),
      b = await image(event);
    const alt = `mutation($eventId:ID!,$id:ID!){updateReferenceEventMedia(eventId:$eventId,id:$id,input:{altText:"  Blue hall  "}){id altText}}`;
    expect(await query(alt, { eventId: event.id, id: b.id }, event.storeId)).toMatchObject({
      data: { updateReferenceEventMedia: { altText: 'Blue hall' } },
    });
    expect(
      await query(reorder, { eventId: event.id, ids: [b.id, a.id] }, event.storeId),
    ).toMatchObject({
      data: {
        reorderReferenceEventMedia: [
          { id: b.id, position: 0, isCover: false },
          { id: a.id, position: 1, isCover: true },
        ],
      },
    });
    expect(await query(reorder, { eventId: event.id, ids: [a.id] }, event.storeId)).toHaveProperty(
      'errors',
    );
    expect(
      await query(reorder, { eventId: event.id, ids: [a.id, a.id] }, event.storeId),
    ).toHaveProperty('errors');
    expect(await query(cover, { eventId: event.id, id: b.id }, event.storeId)).not.toHaveProperty(
      'errors',
    );
    expect(await query(remove, { eventId: event.id, id: b.id }, event.storeId)).not.toHaveProperty(
      'errors',
    );
    expect(await query(list, { eventId: event.id }, event.storeId)).toMatchObject({
      data: { referenceEventMedia: [{ id: a.id, isCover: true, position: 1 }] },
    });
    await expect(readFile(join(root, b.fileKey))).rejects.toThrow();
    expect((await fetch(b.readUrl)).status).toBe(404);
    expect(await query(remove, { eventId: event.id, id: a.id }, event.storeId)).not.toHaveProperty(
      'errors',
    );
    expect(
      (await database.client.event.findUniqueOrThrow({ where: { id: event.id } })).coverMediaId,
    ).toBeNull();
    const entries = await database.client.eventHistory.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((entry) => entry.operation)).toEqual([
      'MEDIA_ADDED',
      'MEDIA_ADDED',
      'MEDIA_UPDATED',
      'MEDIA_REORDERED',
      'COVER_CHANGED',
      'MEDIA_REMOVED',
      'MEDIA_REMOVED',
    ]);
    expect(entries.find((entry) => entry.operation === 'COVER_CHANGED')?.changes).toEqual([
      {
        field: 'cover',
        before: `../../outside.png (${a.id})`,
        after: `../../outside.png (${b.id})`,
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain(a.fileKey);
    expect(JSON.stringify(entries)).not.toContain(a.readUrl);
  });
  it('rejects expired, mismatched, oversized and corrupt uploads and cleans their partial files', async () => {
    const event = await parent();
    for (const input of [{ contentType: 'image/svg+xml' }, { byteSize: 5242881 }, { byteSize: 0 }])
      expect(
        await query(
          create,
          {
            eventId: event.id,
            input: {
              originalName: 'test.png',
              contentType: 'image/png',
              byteSize: png.length,
              ...input,
            },
          },
          event.storeId,
        ),
      ).toHaveProperty('errors');
    const expired = await intent(event);
    await database.client.uploadIntent.update({
      where: { id: expired.uploadId },
      data: { expiresAt: new Date(0) },
    });
    expect((await put(expired)).status).toBe(409);
    const invalid = [
      { bytes: png, type: 'image/jpeg', header: 'image/jpeg' },
      { bytes: png.subarray(0, 32), type: 'image/png', header: 'image/png' },
      { bytes: Buffer.from('<svg>not an image</svg>'), type: 'image/png', header: 'image/png' },
      { bytes: png, type: 'image/png', header: 'image/webp' },
    ];
    for (const sample of invalid) {
      const target = await intent(event, {
        byteSize: sample.bytes.length,
        contentType: sample.type,
      });
      target.headers['content-type'] = sample.header;
      expect((await put(target, sample.bytes)).status).toBe(400);
      expect(
        await database.client.uploadIntent.findUnique({ where: { id: target.uploadId } }),
      ).toBeNull();
      expect((await readdir(root)).filter((name) => name.startsWith(target.fileKey))).toEqual([]);
    }
    const oversized = await intent(event, { byteSize: 1 });
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(oversized.url, { method: 'PUT', headers: oversized.headers }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.once('error', reject);
      req.write(png);
      req.end();
    });
    expect(status).toBe(413);
    expect((await readdir(root)).filter((name) => name.startsWith(oversized.fileKey))).toEqual([]);
    expect(await database.client.eventMedia.count({ where: { eventId: event.id } })).toBe(0);
  });
  it('accepts fully decoded JPEG and WebP and serializes gallery reservations and finalization', async () => {
    const event = await parent();
    for (const format of ['jpeg', 'webp'] as const) {
      const bytes = await sharp(png).toFormat(format).toBuffer();
      const target = await intent(event, {
        contentType: `image/${format}`,
        byteSize: bytes.length,
      });
      expect((await put(target, bytes)).status).toBe(204);
      const results = await Promise.all([
        query(finalize, { uploadId: target.uploadId }, event.storeId),
        query(finalize, { uploadId: target.uploadId }, event.storeId),
      ]);
      expect(result(results[0], 'finalizeReferenceUpload')).toMatchObject({
        id: object(result(results[1], 'finalizeReferenceUpload')).id,
      });
    }
    const requests = await Promise.all(
      Array.from({ length: 9 }, () =>
        query(
          create,
          {
            eventId: event.id,
            input: { originalName: 'test.png', contentType: 'image/png', byteSize: png.length },
          },
          event.storeId,
        ),
      ),
    );
    expect(requests.filter((body) => 'errors' in object(body))).toHaveLength(1);
    expect(await database.client.uploadIntent.count({ where: { eventId: event.id } })).toBe(10);
  });
  it('cleans expired intents and abandoned bytes, retains failed deletion keys and preserves finalized files', async () => {
    const event = await parent(),
      kept = await image(event),
      abandoned = await intent(event),
      partial = await intent(event);
    expect((await put(abandoned)).status).toBe(204);
    await writeFile(join(root, `${partial.fileKey}.part`), png.subarray(0, 10));
    await database.client.uploadIntent.update({
      where: { id: partial.uploadId },
      data: { state: 'UPLOADING', expiresAt: new Date(0) },
    });
    await database.client.uploadIntent.update({
      where: { id: abandoned.uploadId },
      data: { finalizeExpiresAt: new Date(0) },
    });
    expect(await query(finalize, { uploadId: abandoned.uploadId }, event.storeId)).toHaveProperty(
      'errors',
    );
    await media.cleanup();
    for (const row of [abandoned, partial]) {
      expect(
        await database.client.uploadIntent.findUnique({ where: { id: row.uploadId } }),
      ).toBeNull();
      expect((await readdir(root)).filter((name) => name.startsWith(row.fileKey))).toEqual([]);
    }
    expect(await readFile(join(root, kept.fileKey))).toEqual(png);
    const failure = jest
      .spyOn(storage, 'remove')
      .mockRejectedValueOnce(new Error('Disk temporarily unavailable'));
    expect(
      await query(remove, { eventId: event.id, id: kept.id }, event.storeId),
    ).not.toHaveProperty('errors');
    failure.mockRestore();
    expect(
      (await database.client.uploadIntent.findUniqueOrThrow({ where: { id: kept.uploadId } }))
        .state,
    ).toBe('DELETING');
    expect(await readFile(join(root, kept.fileKey))).toEqual(png);
    await media.cleanup();
    expect(
      await database.client.uploadIntent.findUnique({ where: { id: kept.uploadId } }),
    ).toBeNull();
    await expect(readFile(join(root, kept.fileKey))).rejects.toThrow();
  });
  it('keeps active uploads out of cleanup, rejects simultaneous reuse and cleans an interrupted stream', async () => {
    const event = await parent(),
      target = await intent(event);
    let status: number | undefined;
    const req = request(target.url, { method: 'PUT', headers: target.headers }, (res) => {
      status = res.statusCode;
      res.resume();
    });
    req.on('error', () => {});
    req.write(png.subarray(0, 10));
    async function waitFor(check: () => Promise<boolean>) {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await check()) return;
        await delay(20);
      }
      throw new Error('Upload did not reach expected state');
    }
    await waitFor(
      async () =>
        (await database.client.uploadIntent.findUniqueOrThrow({ where: { id: target.uploadId } }))
          .state === 'UPLOADING',
    );
    expect((await put(target)).status).toBe(409);
    await database.client.uploadIntent.update({
      where: { id: target.uploadId },
      data: { expiresAt: new Date(0) },
    });
    await media.cleanup();
    expect(
      (await database.client.uploadIntent.findUniqueOrThrow({ where: { id: target.uploadId } }))
        .state,
    ).toBe('UPLOADING');
    req.end(png.subarray(10));
    await waitFor(() => Promise.resolve(status !== undefined));
    expect(status).toBe(204);
    const broken = await intent(event);
    const interrupted = request(broken.url, { method: 'PUT', headers: broken.headers });
    interrupted.on('error', () => {});
    interrupted.write(png.subarray(0, 10));
    await waitFor(async () => (await readdir(root)).includes(`${broken.fileKey}.part`));
    interrupted.destroy();
    await waitFor(
      async () =>
        !(await database.client.uploadIntent.findUnique({ where: { id: broken.uploadId } })),
    );
    expect((await readdir(root)).filter((name) => name.startsWith(broken.fileKey))).toEqual([]);
  });
  it('preserves a trashed event gallery while denying metadata, downloads and pending finalization', async () => {
    const event = await parent(),
      kept = await image(event),
      pending = await intent(event),
      uploaded = await intent(event);
    expect((await put(uploaded)).status).toBe(204);
    expect(
      await query(
        'mutation($id:ID!){deleteReferenceEvent(id:$id){id}}',
        { id: event.id },
        event.storeId,
      ),
    ).not.toHaveProperty('errors');
    expect(await query(list, { eventId: event.id }, event.storeId)).toHaveProperty('errors');
    expect(await query(finalize, { uploadId: uploaded.uploadId }, event.storeId)).toHaveProperty(
      'errors',
    );
    expect((await put(pending)).status).toBe(404);
    expect((await fetch(kept.readUrl)).status).toBe(404);
    await media.cleanup();
    expect(await readFile(join(root, kept.fileKey))).toEqual(png);
    expect(
      await query(
        'mutation($id:ID!){restoreReferenceEvent(id:$id){id}}',
        { id: event.id },
        event.storeId,
      ),
    ).not.toHaveProperty('errors');
    expect((await fetch(kept.readUrl)).status).toBe(200);
    expect(await database.client.eventHistory.count({ where: { eventId: event.id } })).toBe(3);
  });
});
