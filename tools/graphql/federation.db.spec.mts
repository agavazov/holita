import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createFederationFixture } from './federation-fixture.mjs';

const sofia = '10000000-0000-4000-8000-000000000001';
const plovdiv = '10000000-0000-4000-8000-000000000002';
const create =
  'mutation($input:CreateProductInput!){createProduct(input:$input){id storeId name sku status}}';
const product = 'query($id:ID!){product(id:$id){id storeId name sku status}}';
const update =
  'mutation($id:ID!,$input:UpdateProductInput!){updateProduct(id:$id,input:$input){id name storeId sku status}}';
const remove = 'mutation($id:ID!){deleteProduct(id:$id){id storeId}}';
const list = '{products{items{id storeId}total}}';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected a GraphQL object');
  return value;
}

function createdId(body: unknown): string {
  const id = record(record(record(body).data).createProduct).id;
  if (typeof id !== 'string') throw new Error('Expected a created product ID');
  return id;
}

describe('Reference through the actual federation boundary', () => {
  let fixture: Awaited<ReturnType<typeof createFederationFixture>>;
  let cleanup: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    fixture = await createFederationFixture();
    cleanup = fixture.close;
  });
  afterAll(async () => {
    await cleanup?.();
  });
  const listVenues = '{referenceVenues{items{id storeId name}total}}';
  const createVenue =
    'mutation($input:CreateReferenceVenueInput!){createReferenceVenue(input:$input){id storeId name}}';
  async function query(
    source: string,
    variables: Record<string, unknown> = {},
    storeId = sofia,
    url = fixture.url,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-store-id': storeId,
        'x-request-id': 'reference-integration',
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    return body;
  }
  it('runs scoped lifecycle and history operations through the gateway', async () => {
    const created = await query(
      'mutation($input:CreateReferenceEventInput!){createReferenceEvent(input:$input){id}}',
      {
        input: {
          title: 'Lifecycle',
          code: 'GATEWAY-LIFECYCLE',
          format: 'ONLINE',
          meetingUrl: 'https://example.com/meet',
          startsAt: '2026-11-01T10:00:00Z',
          endsAt: '2026-11-01T12:00:00Z',
        },
      },
    );
    const id = record(record(record(created).data).createReferenceEvent).id;
    if (typeof id !== 'string') throw new Error('Missing event ID');
    expect(
      await query(
        'mutation($ids:[ID!]!){setReferenceEventsStatus(ids:$ids,status:PUBLISHED){count}}',
        { ids: [id] },
      ),
    ).toHaveProperty('data.setReferenceEventsStatus.count', 1);
    expect(
      await query('mutation($ids:[ID!]!){trashReferenceEvents(ids:$ids){count}}', { ids: [id] }),
    ).toHaveProperty('data.trashReferenceEvents.count', 1);
    expect(await query('query($id:ID!){referenceEvent(id:$id){id}}', { id })).toHaveProperty(
      'errors',
    );
    expect(
      await query('query($id:ID!){referenceEvent(id:$id,includeDeleted:true){id store{id}}}', {
        id,
      }),
    ).toMatchObject({ data: { referenceEvent: { id, store: { id: sofia } } } });
    const history =
      'query($id:ID!){referenceEventHistory(eventId:$id){total items{operation actor}}}';
    expect(await query(history, { id })).toHaveProperty('data.referenceEventHistory.total', 3);
    expect(await query(history, { id }, plovdiv)).toHaveProperty('errors');
    expect(
      await query(
        'mutation($ids:[ID!]!){restoreReferenceEvents(ids:$ids){count}}',
        { ids: [id] },
        plovdiv,
      ),
    ).toHaveProperty('errors');
    expect(
      await query('mutation($ids:[ID!]!){restoreReferenceEvents(ids:$ids){count}}', { ids: [id] }),
    ).toHaveProperty('data.restoreReferenceEvents.count', 1);
    expect(
      await query('query($id:ID!){referenceEvent(id:$id){status deletedAt}}', { id }),
    ).toMatchObject({ data: { referenceEvent: { status: 'PUBLISHED', deletedAt: null } } });
  });
  it('keeps binary uploads outside the gateway and disables both media transports with Reference', async () => {
    const eventId = '60000000-0000-4000-8000-000000000001';
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAIAAACDRijCAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAIElEQVQ4jWMwjLtAFcQwapDhaBgZjqajuNEsEkd+OgAAcGAOn5aBl0EAAAAASUVORK5CYII=',
      'base64',
    );
    const source =
      'mutation($eventId:ID!,$input:CreateReferenceUploadInput!){createReferenceUploadIntent(eventId:$eventId,input:$input){uploadId uploadUrl method headers{name value}}}';
    const created = await query(source, {
      eventId,
      input: { originalName: 'gallery.png', contentType: 'image/png', byteSize: bytes.length },
    });
    expect(created).not.toHaveProperty('errors');
    const target = record(record(record(created).data).createReferenceUploadIntent);
    if (
      typeof target.uploadUrl !== 'string' ||
      typeof target.method !== 'string' ||
      !Array.isArray(target.headers)
    )
      throw new Error('Missing upload target');
    const headers: Record<string, string> = {};
    for (const header of target.headers) {
      const value = record(header);
      if (typeof value.name !== 'string' || typeof value.value !== 'string')
        throw new Error('Invalid upload header');
      headers[value.name] = value.value;
    }
    expect(new URL(target.uploadUrl).origin).toBe(new URL(fixture.referenceUrl).origin);
    const observed = fixture.referenceRequests.length;
    const preflight = await fetch(target.uploadUrl, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:11081',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:11081');
    expect(
      (
        await fetch(target.uploadUrl, {
          method: target.method,
          headers,
          body: new Uint8Array(bytes),
        })
      ).status,
    ).toBe(204);
    expect(fixture.referenceRequests).toHaveLength(observed);
    const finish =
      'mutation($uploadId:ID!){finalizeReferenceUpload(uploadId:$uploadId){id isCover readUrl}}';
    expect(await query(finish, { uploadId: target.uploadId }, plovdiv)).toHaveProperty('errors');
    const completed = await query(finish, { uploadId: target.uploadId });
    expect(completed).toMatchObject({ data: { finalizeReferenceUpload: { isCover: true } } });
    const image = record(record(record(completed).data).finalizeReferenceUpload);
    if (typeof image.readUrl !== 'string') throw new Error('Missing read URL');
    expect(Buffer.from(await (await fetch(image.readUrl)).arrayBuffer())).toEqual(bytes);
    expect(
      fixture.referenceRequests.every((item) => {
        const body: unknown = JSON.parse(item.body);
        return isRecord(body) && typeof body.query === 'string';
      }),
    ).toBe(true);
    try {
      await fixture.setReferenceEnabled(false);
      expect(
        (
          await fetch(target.uploadUrl, {
            method: target.method,
            headers,
            body: new Uint8Array(bytes),
          })
        ).status,
      ).toBe(503);
      expect((await fetch(image.readUrl)).status).toBe(503);
      expect(await query(finish, { uploadId: target.uploadId })).toHaveProperty('errors');
    } finally {
      await fixture.setReferenceEnabled(true);
    }
    const restored = await query(
      'query($eventId:ID!){referenceEventMedia(eventId:$eventId){id readUrl}}',
      { eventId },
    );
    expect(restored).toMatchObject({ data: { referenceEventMedia: [{ id: image.id }] } });
    const rows = record(record(restored).data).referenceEventMedia;
    if (!Array.isArray(rows)) throw new Error('Missing gallery');
    const renewed = record(rows[0]).readUrl;
    if (typeof renewed !== 'string') throw new Error('Missing refreshed read URL');
    expect((await fetch(renewed)).status).toBe(200);
  });
  it('transports the 100 KiB rich-text boundary and forwards sanitization errors atomically', async () => {
    const descriptionHtml = `<p>${'я'.repeat(51196)}x</p>`;
    const created = await query(
      'mutation($input:CreateReferenceEventInput!){createReferenceEvent(input:$input){id descriptionHtml}}',
      {
        input: {
          title: 'Rich content',
          code: randomUUID(),
          format: 'ONLINE',
          meetingUrl: 'https://example.com',
          startsAt: '2026-11-01T10:00:00Z',
          endsAt: '2026-11-01T12:00:00Z',
          descriptionHtml,
        },
      },
    );
    expect(created).toMatchObject({ data: { createReferenceEvent: { descriptionHtml } } });
    const id = record(record(record(created).data).createReferenceEvent).id;
    const mutation =
      'mutation($id:ID!,$input:UpdateReferenceEventInput!){updateReferenceEvent(id:$id,input:$input){id descriptionHtml}}';
    expect(
      await query(mutation, {
        id,
        input: { title: 'Invalid', descriptionHtml: descriptionHtml + 'x' },
      }),
    ).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'descriptionHtml' }],
            requestId: 'reference-integration',
          },
        },
      ],
    });
    expect(
      await query('query($id:ID!){referenceEvent(id:$id){title descriptionHtml}}', { id }),
    ).toMatchObject({ data: { referenceEvent: { title: 'Rich content', descriptionHtml } } });
    expect(
      await query(mutation, {
        id,
        input: {
          descriptionHtml:
            '<p style="color:red">Safe <a href="javascript:alert(1)">link</a><img src="x" onerror="alert(1)"></p>',
        },
      }),
    ).toMatchObject({
      data: { updateReferenceEvent: { descriptionHtml: '<p>Safe <a>link</a></p>' } },
    });
    expect(await query(mutation, { id, input: { descriptionHtml: null } }, plovdiv)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
  });
  it('federates Venue.store and keeps concurrent contexts and foreign writes separate', async () => {
    const body = await query(createVenue, {
      input: { name: 'Real venue', city: 'Sofia', countryCode: 'BG' },
    });
    const id = record(record(record(body).data).createReferenceVenue).id;
    if (typeof id !== 'string') throw new Error('Missing venue ID');
    expect(
      await query('query($id:ID!){referenceVenue(id:$id){name store{id name}}}', { id }),
    ).toEqual({
      data: { referenceVenue: { name: 'Real venue', store: { id: sofia, name: 'holita Sofia' } } },
    });
    fixture.coreRequests.length = 0;
    await Promise.all(
      [sofia, plovdiv].map(async (storeId) => {
        const result = record(
          record(record(await query(listVenues, {}, storeId)).data).referenceVenues,
        );
        if (!Array.isArray(result.items)) throw new Error('Missing venues');
        expect(result.items.every((item: unknown) => record(item).storeId === storeId)).toBe(true);
      }),
    );
    for (const source of [
      'query($id:ID!){referenceVenue(id:$id){id}}',
      'mutation($id:ID!){updateReferenceVenue(id:$id,input:{name:"Wrong"}){id}}',
      'mutation($id:ID!){deleteReferenceVenue(id:$id){id}}',
    ])
      expect(await query(source, { id }, plovdiv)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    expect(fixture.coreRequests).toHaveLength(0);
    expect(fixture.referenceRequests).toContainEqual(
      expect.objectContaining({ requestId: 'reference-integration', storeId: sofia }),
    );
  });
  it('checks store existence once per Reference request and refuses unknown stores', async () => {
    fixture.coreRequests.length = 0;
    const input = { name: 'Batch venue', city: 'Sofia', countryCode: 'BG' };
    expect(
      await query(
        'mutation($input:CreateReferenceVenueInput!){a:createReferenceVenue(input:$input){id}b:createReferenceVenue(input:$input){id}}',
        { input },
        sofia,
        fixture.referenceUrl,
      ),
    ).toMatchObject({ data: { a: { id: expect.any(String) }, b: { id: expect.any(String) } } });
    expect(fixture.coreRequests).toHaveLength(1);
    expect(await query(createVenue, { input }, randomUUID())).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
  });
  it('keeps reads and writes independent of core except for creation', async () => {
    const id = '30000000-0000-4000-8000-000000000002';
    await fixture.stopCore();
    try {
      expect(await query(listVenues)).toHaveProperty('data.referenceVenues');
      expect(
        await query(
          'mutation($id:ID!){updateReferenceVenue(id:$id,input:{active:false}){active}}',
          { id },
        ),
      ).toMatchObject({ data: { updateReferenceVenue: { active: false } } });
      const before = await query(listVenues);
      expect(
        await query(createVenue, {
          input: { name: 'Unavailable', city: 'Sofia', countryCode: 'BG' },
        }),
      ).toMatchObject({ errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }] });
      expect(await query(listVenues)).toEqual(before);
      expect(await query('mutation($id:ID!){deleteReferenceVenue(id:$id){id}}', { id })).toEqual({
        data: { deleteReferenceVenue: { id } },
      });
    } finally {
      await fixture.restartCore();
    }
  });
  it('federates all new entities and preserves public validation details through the gateway', async () => {
    const source =
      'mutation($input:CreateReferenceEventInput!){createReferenceEvent(input:$input){id title store{id name} budget}}';
    const input = {
      title: 'Federated forum',
      code: 'FEDERATED',
      format: 'ONLINE',
      meetingUrl: 'https://example.com/forum',
      startsAt: '2026-12-01T10:00:00Z',
      endsAt: '2026-12-01T12:00:00Z',
      budget: '1234.50',
    };
    const body = await query(source, { input });
    expect(body).toMatchObject({
      data: {
        createReferenceEvent: {
          title: input.title,
          budget: '1234.50',
          store: { id: sofia, name: 'holita Sofia' },
        },
      },
    });
    const id = record(record(record(body).data).createReferenceEvent).id;
    expect(
      await query('query($id:ID!){referenceEvent(id:$id){id}}', { id }, plovdiv),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(
      await query(source, { input: { ...input, code: 'INVALID', budget: '1.001' } }),
    ).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            requestId: 'reference-integration',
            fieldErrors: [{ path: 'budget', message: expect.any(String) }],
          },
        },
      ],
    });
    expect(
      await query('{referenceSpeakers{items{store{id}}}referenceTags{items{store{id}}}}'),
    ).toMatchObject({
      data: {
        referenceSpeakers: { items: [{ store: { id: sofia } }] },
        referenceTags: { items: expect.arrayContaining([{ store: { id: sofia } }]) },
      },
    });
    await fixture.stopCore();
    try {
      expect(
        await query(
          'mutation($id:ID!){updateReferenceEvent(id:$id,input:{summary:"Without Core"}){id summary}}',
          { id },
        ),
      ).toMatchObject({ data: { updateReferenceEvent: { id, summary: 'Without Core' } } });
      expect(await query(source, { input: { ...input, code: 'UNAVAILABLE' } })).toMatchObject({
        errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }],
      });
    } finally {
      await fixture.restartCore();
    }
  });
  it('filters Events and resolves nested Venue/Tag store references through the gateway', async () => {
    const source =
      'query($filter:ReferenceEventFilter,$sort:ReferenceEventSort){referenceEvents(filter:$filter,sort:$sort){total items{code venue{name store{id}} tags{name store{id}}}}}';
    const id = '60000000-0000-4000-8000-000000000001';
    const tagId = '40000000-0000-4000-8000-000000000001';
    expect(
      await query(
        'mutation($id:ID!,$tags:[ID!]!){updateReferenceEvent(id:$id,input:{tagIds:$tags}){id}}',
        { id, tags: [tagId] },
      ),
    ).toMatchObject({ data: { updateReferenceEvent: { id } } });
    const variables = {
      filter: { search: 'SOFIA-FORUM', statuses: ['DRAFT'], tagIds: [tagId] },
      sort: { field: 'BUDGET', direction: 'DESC' },
    };
    expect(await query(source, variables)).toEqual({
      data: {
        referenceEvents: {
          total: 1,
          items: [
            {
              code: 'SOFIA-FORUM',
              venue: { name: 'The Glasshouse', store: { id: sofia } },
              tags: [{ name: 'Community', store: { id: sofia } }],
            },
          ],
        },
      },
    });
    expect(await query(source, variables, plovdiv)).toEqual({
      data: { referenceEvents: { total: 0, items: [] } },
    });
  });
  it('scopes Sessions through the gateway, federates their speakers and preserves parent rules', async () => {
    const eventId = '60000000-0000-4000-8000-000000000001';
    const speakerId = '50000000-0000-4000-8000-000000000001';
    const source =
      'mutation($eventId:ID!,$input:CreateReferenceSessionInput!){createReferenceSession(eventId:$eventId,input:$input){id title speakers{id name store{id}}}}';
    const input = {
      title: 'Gateway session',
      startsAt: '2026-11-12T09:00:00Z',
      endsAt: '2026-11-12T10:00:00Z',
      speakerIds: [speakerId],
    };
    const body = await query(source, { eventId, input });
    expect(body).toMatchObject({
      data: {
        createReferenceSession: {
          title: 'Gateway session',
          speakers: [{ id: speakerId, store: { id: sofia } }],
        },
      },
    });
    const id = record(record(record(body).data).createReferenceSession).id;
    if (typeof id !== 'string') throw new Error('Missing session ID');
    const read = 'query($eventId:ID!,$id:ID!){referenceSession(eventId:$eventId,id:$id){id}}';
    expect(await query(read, { eventId, id }, plovdiv)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(
      await query(source, { eventId, input: { ...input, endsAt: '2026-11-12T19:00:00Z' } }),
    ).toMatchObject({
      errors: [
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'endsAt' }],
            requestId: 'reference-integration',
          },
        },
      ],
    });
    expect(
      await query(
        'mutation($id:ID!){updateReferenceEvent(id:$id,input:{endsAt:"2026-11-12T09:30:00Z"}){id}}',
        { id: eventId },
      ),
    ).toMatchObject({ errors: [{ extensions: { fieldErrors: [{ path: 'endsAt' }] } }] });
    const order =
      'mutation($eventId:ID!,$ids:[ID!]!){reorderReferenceSessions(eventId:$eventId,ids:$ids){id position}}';
    expect(await query(order, { eventId, ids: [id] })).toEqual({
      data: { reorderReferenceSessions: [{ id, position: 0 }] },
    });
    expect(await query(order, { eventId, ids: [] })).toMatchObject({
      errors: [{ extensions: { code: 'CONFLICT' } }],
    });
    expect(
      await query(
        'mutation($eventId:ID!,$id:ID!){deleteReferenceSession(eventId:$eventId,id:$id){id}}',
        { eventId, id },
      ),
    ).toEqual({ data: { deleteReferenceSession: { id } } });
  });
  it('disables business operations and entity lookups while preserving health, Products and stored data', async () => {
    const before = await query(listVenues);
    await fixture.setReferenceEnabled(false);
    try {
      const id = '30000000-0000-4000-8000-000000000001';
      for (const source of [
        listVenues,
        '{referenceEvents{total}}',
        '{referenceSpeakers{total}}',
        '{referenceTags{total}}',
        'query($id:ID!){referenceEvent(id:$id,includeDeleted:true){id}}',
        'query($id:ID!){referenceEventHistory(eventId:$id){total}}',
        'mutation($id:ID!){restoreReferenceEvent(id:$id){id}}',
        'mutation($id:ID!){setReferenceEventsStatus(ids:[$id],status:PUBLISHED){count}}',
        'mutation($id:ID!){trashReferenceEvents(ids:[$id]){count}}',
        'mutation($id:ID!){restoreReferenceEvents(ids:[$id]){count}}',
        'query($id:ID!){referenceSessions(eventId:$id){id}}',
        'mutation($id:ID!){reorderReferenceSessions(eventId:$id,ids:[]){id}}',
        'mutation($id:ID!){updateReferenceEvent(id:$id,input:{title:"Disabled"}){id}}',
        'mutation{createReferenceSpeaker(input:{name:"Disabled"}){id}}',
        'mutation{createReferenceTag(input:{name:"Disabled",color:"#315ed0"}){id}}',
        'query($id:ID!){referenceVenue(id:$id){id}}',
        'mutation{createReferenceVenue(input:{name:"Disabled",city:"Sofia",countryCode:"BG"}){id}}',
        'mutation($id:ID!){updateReferenceVenue(id:$id,input:{name:"Disabled"}){id}}',
        'mutation($id:ID!){deleteReferenceVenue(id:$id){id}}',
      ])
        expect(await query(source, { id })).toMatchObject({
          errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }],
        });
      for (const type of ['ReferenceVenue', 'ReferenceEvent', 'ReferenceSpeaker', 'ReferenceTag']) {
        expect(
          await query(
            `query($refs:[_Any!]!){_entities(representations:$refs){...on ${type}{id}}}`,
            { refs: [{ __typename: type, id }] },
            sofia,
            fixture.referenceUrl,
          ),
        ).toMatchObject({ errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }] });
      }
      const health = await fetch(fixture.referenceUrl.replace('/graphql', '/health'));
      expect(health.status).toBe(200);
      await health.text();
      expect(await query('{products{total}}')).toMatchObject({ data: { products: { total: 3 } } });
    } finally {
      await fixture.setReferenceEnabled(true);
    }
    expect(await query(listVenues)).toEqual(before);
  });
});

describe('actual gateway, subgraphs and PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createFederationFixture>>;
  let cleanup: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    fixture = await createFederationFixture();
    cleanup = fixture.close;
  });
  beforeEach(() => {
    fixture.coreRequests.length = 0;
    fixture.productRequests.length = 0;
  });
  afterAll(async () => {
    await cleanup?.();
  });

  async function query(
    source: string,
    variables: Record<string, unknown> = {},
    storeId?: string,
    requestId: string = randomUUID(),
    url = fixture.url,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        ...(storeId === undefined ? {} : { 'x-store-id': storeId }),
      },
      body: JSON.stringify({ query: source, variables }),
      signal: AbortSignal.timeout(10000),
    });
    expect(response.headers.get('x-request-id')).toBe(requestId);
    const body: unknown = await response.json();
    return body;
  }

  it('discovers both seeded stores through the gateway without selecting a store', async () => {
    expect(await query('{stores{id name}}')).toEqual({
      data: {
        stores: [
          { id: plovdiv, name: 'holita Plovdiv' },
          { id: sofia, name: 'holita Sofia' },
        ],
      },
    });
    expect(fixture.productRequests).toHaveLength(0);
    expect(fixture.coreRequests).toHaveLength(1);
  });

  it('allows the configured admin origin and context headers through browser CORS', async () => {
    const response = await fetch(fixture.url, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:11081',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-store-id,x-request-id',
      },
      signal: AbortSignal.timeout(5000),
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:11081');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-store-id');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-request-id');
    expect(fixture.coreRequests).toHaveLength(0);
    expect(fixture.productRequests).toHaveLength(0);
  });

  it('rejects oversized baggage before forwarding to either subgraph', async () => {
    const response = await fetch(fixture.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', baggage: `key=${'x'.repeat(20 * 1024)}` },
      body: JSON.stringify({ query: '{ stores { id } }' }),
      signal: AbortSignal.timeout(5000),
    });
    await response.text();
    expect(response.status).toBe(431);
    expect(fixture.coreRequests).toHaveLength(0);
    expect(fixture.productRequests).toHaveLength(0);
  });

  it('creates products and resolves their real Store through federation', async () => {
    const sku = randomUUID();
    const id = createdId(
      await query(create, { input: { name: '  Federated notebook  ', sku } }, sofia),
    );
    fixture.coreRequests.length = 0;
    expect(
      await query(
        'query($id:ID!){product(id:$id){id name store{id name}}}',
        { id },
        sofia,
        'federated-request',
      ),
    ).toEqual({
      data: {
        product: { id, name: 'Federated notebook', store: { id: sofia, name: 'holita Sofia' } },
      },
    });
    expect(fixture.coreRequests).toHaveLength(1);
    expect(fixture.coreRequests[0]).toMatchObject({
      requestId: 'federated-request',
      storeId: sofia,
    });
    expect(fixture.coreRequests[0]?.body).toContain('_entities');
    expect(
      await query(create, { input: { name: 'Same SKU elsewhere', sku } }, plovdiv),
    ).toMatchObject({ data: { createProduct: { sku, storeId: plovdiv } } });
    expect(await query(create, { input: { name: 'Duplicate', sku } }, sofia)).toMatchObject({
      errors: [{ extensions: { code: 'CONFLICT' } }],
    });
  });

  it('enforces store scoping on reads and writes at the public endpoint', async () => {
    const id = createdId(
      await query(create, { input: { name: 'Scoped product', sku: randomUUID() } }, sofia),
    );
    fixture.coreRequests.length = 0;
    for (const source of [product, update, remove])
      expect(await query(source, { id, input: { name: 'Foreign edit' } }, plovdiv)).toMatchObject({
        errors: [{ extensions: { code: 'NOT_FOUND' } }],
      });
    expect(
      await query(update, { id, input: { name: 'Owner edit', status: 'ACTIVE' } }, sofia),
    ).toMatchObject({ data: { updateProduct: { name: 'Owner edit', status: 'ACTIVE' } } });
    expect(await query(remove, { id }, sofia)).toEqual({
      data: { deleteProduct: { id, storeId: sofia } },
    });
    expect(await query(product, { id }, sofia)).toMatchObject({
      errors: [{ extensions: { code: 'NOT_FOUND' } }],
    });
    expect(fixture.coreRequests).toHaveLength(0);
  });

  it('keeps unknown store semantics and rejects missing or malformed context', async () => {
    const unknown = randomUUID();
    expect(await query(list, {}, unknown)).toEqual({ data: { products: { items: [], total: 0 } } });
    expect(fixture.coreRequests).toHaveLength(0);
    for (const store of [undefined, 'invalid'])
      expect(await query(list, {}, store)).toMatchObject({
        errors: [{ extensions: { code: 'BAD_USER_INPUT' } }],
      });
    expect(
      await query(create, { input: { name: 'No store', sku: randomUUID() } }, unknown),
    ).toMatchObject({ errors: [{ extensions: { code: 'NOT_FOUND' } }] });
    expect(await query(list, {}, unknown)).toEqual({ data: { products: { items: [], total: 0 } } });
    expect(fixture.coreRequests).toHaveLength(1);
  });

  it('keeps concurrent request/store headers separate without validating stores in the gateway', async () => {
    await Promise.all(
      [sofia, plovdiv].map(async (storeId, index) => {
        const requestId = `concurrent-${String(index)}`;
        const result = record(record(await query(list, {}, storeId, requestId)).data);
        const items: unknown = record(result.products).items;
        if (!Array.isArray(items)) throw new Error('Expected product list');
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((item: unknown) => record(item).storeId === storeId)).toBe(true);
        expect(fixture.productRequests).toContainEqual(
          expect.objectContaining({ requestId, storeId }),
        );
      }),
    );
    expect(fixture.coreRequests).toHaveLength(0);
  });

  it('reuses store validation for multiple creates in one products request', async () => {
    const sku = randomUUID();
    const source = `mutation($a:CreateProductInput!,$b:CreateProductInput!){a:createProduct(input:$a){id}b:createProduct(input:$b){id}}`;
    expect(
      await query(
        source,
        { a: { name: 'First', sku: `${sku}-1` }, b: { name: 'Second', sku: `${sku}-2` } },
        sofia,
        'create-batch',
        fixture.productsUrl,
      ),
    ).toMatchObject({ data: { a: { id: expect.any(String) }, b: { id: expect.any(String) } } });
    expect(fixture.coreRequests).toHaveLength(1);
    expect(fixture.coreRequests[0]).toMatchObject({ requestId: 'create-batch' });
  });

  it('keeps product-only CRUD independent of core and fails creation/federated Store without writing', async () => {
    const id = createdId(
      await query(create, { input: { name: 'Before outage', sku: randomUUID() } }, sofia),
    );
    await fixture.stopCore();
    try {
      fixture.coreRequests.length = 0;
      expect(await query(product, { id }, sofia)).toMatchObject({ data: { product: { id } } });
      expect(
        await query(update, { id, input: { name: 'Edited during outage' } }, sofia),
      ).toMatchObject({ data: { updateProduct: { name: 'Edited during outage' } } });
      const before = await query(list, {}, sofia);
      expect(fixture.coreRequests).toHaveLength(0);
      expect(
        await query(create, { input: { name: 'Must not persist', sku: randomUUID() } }, sofia),
      ).toMatchObject({ errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }] });
      expect(await query(list, {}, sofia)).toEqual(before);
      expect(
        await query('query($id:ID!){product(id:$id){store{name}}}', { id }, sofia),
      ).toMatchObject({ errors: [{ extensions: { code: 'SERVICE_UNAVAILABLE' } }] });
      expect(await query(remove, { id }, sofia)).toEqual({
        data: { deleteProduct: { id, storeId: sofia } },
      });
    } finally {
      await fixture.restartCore();
    }
  });
});
