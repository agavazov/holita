import { historyOptions, historyDocuments } from './history-provider.js';
import { mediaOptions, mediaDocuments, mediaMutation } from './media-provider.js';
import type { DataProvider } from '@refinedev/core';
import createGraphQLProvider from '@refinedev/graphql';
import { Client, fetchExchange } from '@urql/core';
import { DataError, responseFieldErrors, type FieldError } from './data-error.js';
import { productsOptions, productsDocuments, ListStoresDocument } from './products-provider.js';
import { venuesOptions, venuesDocuments } from './venues-provider.js';
import { eventsOptions, eventsDocuments, eventMutation } from './events-provider.js';
import { speakersOptions, speakersDocuments } from './speakers-provider.js';
import { tagsOptions, tagsDocuments } from './tags-provider.js';
import { sessionsOptions, sessionsDocuments, sessionEventId } from './sessions-provider.js';
import {
  ReorderReferenceSessionsDocument,
  type ReorderReferenceSessionsMutationVariables,
} from '../generated/graphql/operations.js';
export { DataError } from './data-error.js';

export function productsResource(storeId: string) {
  return `stores/${storeId.toLowerCase()}/products`;
}
export function venuesResource(storeId: string) {
  return `stores/${storeId.toLowerCase()}/reference/venues`;
}
export function eventsResource(storeId: string) {
  return `stores/${storeId.toLowerCase()}/reference/events`;
}
export function speakersResource(storeId: string) {
  return `stores/${storeId.toLowerCase()}/reference/speakers`;
}
export function tagsResource(storeId: string) {
  return `stores/${storeId.toLowerCase()}/reference/tags`;
}
export function sessionsResource(storeId: string, eventId: string) {
  return `${eventsResource(storeId)}/${eventId.toLowerCase()}/sessions`;
}
export function mediaResource(storeId: string, eventId: string) {
  return `${eventsResource(storeId)}/${eventId.toLowerCase()}/media`;
}
export function historyResource(storeId: string, eventId: string) {
  return `${eventsResource(storeId)}/${eventId.toLowerCase()}/history`;
}
function storeContext(resource: string) {
  if (resource === 'stores') return undefined;
  const match =
    /^stores\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(?:products|reference\/(?:venues|events|speakers|tags|events\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:sessions|media|history)))$/i.exec(
      resource,
    );
  if (!match?.[1]) throw new DataError('Select a valid store before accessing records.');
  return match[1].toLowerCase();
}
function mapping(resource: string) {
  if (resource.endsWith('/history'))
    return { options: historyOptions, documents: historyDocuments };
  if (resource.endsWith('/media')) return { options: mediaOptions, documents: mediaDocuments };
  if (resource.endsWith('/sessions'))
    return { options: sessionsOptions, documents: sessionsDocuments };
  if (resource.endsWith('/reference/venues'))
    return { options: venuesOptions, documents: venuesDocuments };
  if (resource.endsWith('/reference/events'))
    return { options: eventsOptions, documents: eventsDocuments };
  if (resource.endsWith('/reference/speakers'))
    return { options: speakersOptions, documents: speakersDocuments };
  if (resource.endsWith('/reference/tags'))
    return { options: tagsOptions, documents: tagsDocuments };
  return { options: productsOptions, documents: productsDocuments };
}
export function createDataProvider(url: string): DataProvider {
  async function request<T>(
    resource: string,
    execute: (provider: DataProvider) => Promise<T>,
  ): Promise<T> {
    const storeId = storeContext(resource),
      requestId = crypto.randomUUID();
    let fieldErrors: FieldError[] = [];
    // Headers and error details belong to this single request. Refine owns the only cache.
    const client = new Client({
      url,
      exchanges: [fetchExchange],
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        if (response.headers.get('content-type')?.includes('json')) {
          const body: unknown = await response.clone().json();
          fieldErrors = responseFieldErrors(body);
        }
        return response;
      },
      fetchOptions: {
        headers: { 'x-request-id': requestId, ...(storeId ? { 'x-store-id': storeId } : {}) },
        signal: AbortSignal.timeout(10_000),
      },
    });
    try {
      return await execute(createGraphQLProvider(client, mapping(resource).options));
    } catch (error) {
      const message =
        error instanceof Error && error.message.startsWith('[GraphQL] ')
          ? error.message.slice('[GraphQL] '.length)
          : 'Could not reach the gateway. Please try again.';
      throw new DataError(message, requestId, fieldErrors);
    }
  }
  function scopedRequest<T>(resource: string, execute: (provider: DataProvider) => Promise<T>) {
    if (resource === 'stores') throw new DataError('Stores are read-only.');
    return request(resource, execute);
  }
  return {
    getApiUrl: () => url,
    custom: (params) => {
      const resource = params.url;
      const payload: unknown = params.payload;
      if (resource.endsWith('/media') || resource.endsWith('/reference/events')) {
        if (params.method !== 'post') throw new DataError('Use POST for record actions.');
        const operation = resource.endsWith('/media')
          ? mediaMutation(resource, payload)
          : eventMutation(payload);
        return scopedRequest(resource, (provider) => {
          if (!provider.custom) throw new DataError('Record actions are unavailable.');
          return provider.custom({
            url: '',
            method: 'post',
            payload: operation.variables,
            meta: { gqlMutation: operation.document },
          });
        });
      }
      if (
        params.method !== 'post' ||
        typeof payload !== 'object' ||
        payload === null ||
        !('ids' in payload) ||
        !Array.isArray(payload.ids) ||
        !payload.ids.every((id: unknown) => typeof id === 'string')
      )
        throw new DataError('Provide the complete session order.');
      const variables: ReorderReferenceSessionsMutationVariables = {
        eventId: sessionEventId(resource),
        ids: payload.ids,
      };
      return scopedRequest(resource, (provider) => {
        if (!provider.custom) throw new DataError('Session ordering is unavailable.');
        return provider.custom({
          url: '',
          method: 'post',
          payload: variables,
          meta: { gqlMutation: ReorderReferenceSessionsDocument },
        });
      });
    },
    getList: (params) =>
      request(params.resource, (provider) =>
        provider.getList({
          ...params,
          meta: {
            gqlQuery:
              params.resource === 'stores'
                ? ListStoresDocument
                : mapping(params.resource).documents.list,
          },
        }),
      ),
    getOne: (params) => {
      const document = mapping(params.resource).documents.one;
      if (!document) throw new DataError('This resource has no detail query.');
      return scopedRequest(params.resource, (provider) =>
        provider.getOne({
          ...params,
          meta: { includeDeleted: params.meta?.includeDeleted === true, gqlQuery: document },
        }),
      );
    },
    create: (params) => {
      const document = mapping(params.resource).documents.create;
      if (!document) throw new DataError('This resource does not support direct creation.');
      return scopedRequest(params.resource, (provider) =>
        provider.create({
          ...params,
          meta: { gqlMutation: document },
        }),
      );
    },
    update: (params) => {
      const document = mapping(params.resource).documents.update;
      if (!document) throw new DataError('This resource is read-only.');
      return scopedRequest(params.resource, (provider) =>
        provider.update({ ...params, meta: { gqlMutation: document } }),
      );
    },
    deleteOne: (params) => {
      const document = mapping(params.resource).documents.delete;
      if (!document) throw new DataError('This resource is read-only.');
      return scopedRequest(params.resource, (provider) =>
        provider.deleteOne({ ...params, meta: { gqlMutation: document } }),
      );
    },
  };
}
