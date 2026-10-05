import { vi } from 'vitest';

import type {
  ListStoresQuery,
  ProductDetailsFragment,
  ReferenceVenueDetailsFragment,
  ReferenceEventDetailsFragment,
  ReferenceSessionDetailsFragment,
} from '../generated/graphql/operations.js';

export const storeA = '10000000-0000-4000-8000-000000000001';
export const storeB = '10000000-0000-4000-8000-000000000002';
export const stores: ListStoresQuery['stores'] = [
  { id: storeA, name: 'Sofia Store' },
  { id: storeB, name: 'Plovdiv Store' },
];

export function product(storeId = storeA, name = 'Sofia notebook'): ProductDetailsFragment {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    storeId,
    name,
    sku: 'NOTE-001',
    status: 'DRAFT',
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
  };
}

export function venue(storeId = storeA, name = 'The Glasshouse'): ReferenceVenueDetailsFragment {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    storeId,
    name,
    city: 'Sofia',
    countryCode: 'BG',
    description: null,
    address: null,
    capacity: 240,
    active: true,
    createdAt: '2026-09-27T00:00:00.000Z',
    updatedAt: '2026-09-27T00:00:00.000Z',
  };
}

export type GraphQLCall = {
  operation: string;
  storeId: string | null;
  requestId: string | null;
  language: string | null;
  variables: Record<string, unknown>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mockGraphQL(handler: (call: GraphQLCall) => Response | Promise<Response>) {
  const calls: GraphQLCall[] = [];
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON GraphQL request.');
    const body: unknown = JSON.parse(init.body);
    if (!record(body) || typeof body.operationName !== 'string' || !record(body.variables))
      throw new Error('Invalid GraphQL request.');
    const headers = new Headers(init.headers);
    const call = {
      operation: body.operationName,
      variables: body.variables,
      storeId: headers.get('x-store-id'),
      requestId: headers.get('x-request-id'),
      language: headers.get('Accept-Language'),
    };
    calls.push(call);
    return handler(call);
  });
  vi.stubGlobal('fetch', fetch);
  return { calls, fetch };
}

export function result(data: unknown) {
  return Response.json({ data });
}

export function deferredResponse() {
  let resolve: (response: Response) => void = () => {
    throw new Error('Deferred response not initialized.');
  };
  const promise = new Promise<Response>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

export function event(storeId = storeA, title = 'Sofia forum'): ReferenceEventDetailsFragment {
  return {
    id: '60000000-0000-4000-8000-000000000001',
    storeId,
    title,
    code: 'FORUM',
    status: 'DRAFT',
    format: 'ONLINE',
    startsAt: '2026-11-01T10:00:00.000Z',
    endsAt: '2026-11-01T12:00:00.000Z',
    registrationOpensOn: '2026-10-01',
    registrationClosesOn: '2026-11-01',
    venueId: null,
    meetingUrl: 'https://example.com/forum',
    tagIds: [],
    tags: [],
    venue: null,
    capacity: 80,
    budget: '9999999999.99',
    featured: false,
    summary: 'A short introduction.',
    descriptionHtml: null,
    deletedAt: null,
    createdAt: '2026-09-27T00:00:00.000Z',
    updatedAt: '2026-09-27T00:00:00.000Z',
  };
}

export function session(title = 'Opening', position = 0): ReferenceSessionDetailsFragment {
  return {
    id: `70000000-0000-4000-8000-${String(position + 1).padStart(12, '0')}`,
    storeId: storeA,
    eventId: event().id,
    title,
    position,
    summary: 'A short session.',
    room: 'Main hall',
    startsAt: event().startsAt,
    endsAt: '2026-11-01T11:00:00.000Z',
    speakerIds: [],
    speakers: [],
    createdAt: event().createdAt,
    updatedAt: event().updatedAt,
  };
}
