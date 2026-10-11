import { delay, http, HttpResponse } from 'msw';
import { graphql, type GraphQLResponseBody } from 'msw/graphql';
import { parse, print, type DocumentNode } from 'graphql';
import { addTypenameToDocument } from '@apollo/client/utilities';
import { PrototypeError } from './prototype-error';
import {
  AdminStoresDocument,
  AdminProductsDocument,
  AdminProductDocument,
  AdminCreateProductDocument,
  AdminUpdateProductDocument,
  AdminDeleteProductDocument,
  AdminVenuesDocument,
  AdminVenueDocument,
  AdminCreateVenueDocument,
  AdminUpdateVenueDocument,
  AdminDeleteVenueDocument,
  AdminVehiclesDocument,
  AdminVehicleDocument,
  AdminCreateVehicleDocument,
  AdminUpdateVehicleDocument,
  AdminDeleteVehicleDocument,
  AdminSpeakersDocument,
  AdminSpeakerDocument,
  AdminCreateSpeakerDocument,
  AdminUpdateSpeakerDocument,
  AdminDeleteSpeakerDocument,
  AdminTagsDocument,
  AdminTagDocument,
  AdminCreateTagDocument,
  AdminUpdateTagDocument,
  AdminDeleteTagDocument,
  AdminMediaDocument,
  AdminUploadIntentDocument,
  AdminFinalizeUploadDocument,
  AdminUpdateMediaDocument,
  AdminDeleteMediaDocument,
  AdminMediaCoverDocument,
  AdminReorderMediaDocument,
  AdminEventsDocument,
  AdminEventDocument,
  AdminCreateEventDocument,
  AdminUpdateEventDocument,
  AdminSetEventsStatusDocument,
  AdminTrashEventsDocument,
  AdminRestoreEventsDocument,
  AdminEventHistoryDocument,
  AdminSessionsDocument,
  AdminSessionDocument,
  AdminCreateSessionDocument,
  AdminUpdateSessionDocument,
  AdminDeleteSessionDocument,
  AdminReorderSessionsDocument,
} from '../../generated/graphql/operations';
import type { PrototypeState } from './state';

const documents: readonly DocumentNode[] = [
  AdminStoresDocument,
  AdminProductsDocument,
  AdminProductDocument,
  AdminCreateProductDocument,
  AdminUpdateProductDocument,
  AdminDeleteProductDocument,
  AdminVenuesDocument,
  AdminVenueDocument,
  AdminCreateVenueDocument,
  AdminUpdateVenueDocument,
  AdminDeleteVenueDocument,
  AdminVehiclesDocument,
  AdminVehicleDocument,
  AdminCreateVehicleDocument,
  AdminUpdateVehicleDocument,
  AdminDeleteVehicleDocument,
  AdminSpeakersDocument,
  AdminSpeakerDocument,
  AdminCreateSpeakerDocument,
  AdminUpdateSpeakerDocument,
  AdminDeleteSpeakerDocument,
  AdminTagsDocument,
  AdminTagDocument,
  AdminCreateTagDocument,
  AdminUpdateTagDocument,
  AdminDeleteTagDocument,
  AdminMediaDocument,
  AdminUploadIntentDocument,
  AdminFinalizeUploadDocument,
  AdminUpdateMediaDocument,
  AdminDeleteMediaDocument,
  AdminMediaCoverDocument,
  AdminReorderMediaDocument,
  AdminEventsDocument,
  AdminEventDocument,
  AdminCreateEventDocument,
  AdminUpdateEventDocument,
  AdminSetEventsStatusDocument,
  AdminTrashEventsDocument,
  AdminRestoreEventsDocument,
  AdminEventHistoryDocument,
  AdminSessionsDocument,
  AdminSessionDocument,
  AdminCreateSessionDocument,
  AdminUpdateSessionDocument,
  AdminDeleteSessionDocument,
  AdminReorderSessionsDocument,
];
const allowedQueries = new Set(
  documents.flatMap((document) => [print(document), print(addTypenameToDocument(document))]),
);

async function respond<T extends Record<string, unknown>>(
  request: Request,
  execute: () => T | Promise<T>,
): Promise<HttpResponse<GraphQLResponseBody<T>>> {
  await delay(150);
  try {
    return HttpResponse.json<GraphQLResponseBody<T>>({ data: await execute() });
  } catch (error) {
    return HttpResponse.json<GraphQLResponseBody<T>>({
      errors: [
        {
          message:
            error instanceof PrototypeError
              ? error.message
              : 'Prototype request failed. Reload and try again.',
          extensions: {
            requestId: request.headers.get('x-request-id'),
            fieldErrors: error instanceof PrototypeError ? error.fieldErrors : [],
          },
        },
      ],
    });
  }
}

export function createPrototypeHandlers(endpoint: string, state: PrototypeState) {
  const api = graphql.link(endpoint);
  const origin = new URL(endpoint).origin;
  return [
    http.all(endpoint, async ({ request }) => {
      try {
        const body: unknown = request.method === 'POST' ? await request.clone().json() : null;
        if (
          typeof body === 'object' &&
          body !== null &&
          'query' in body &&
          typeof body.query === 'string' &&
          allowedQueries.has(print(parse(body.query)))
        )
          return;
      } catch {
        /* Reject invalid and non-generated operation documents. */
      }
      return HttpResponse.json({
        errors: [{ message: 'This operation is unavailable in Prototype.' }],
      });
    }),
    api.query(AdminStoresDocument, ({ request }) =>
      respond(request, () => ({ stores: state.listStores() })),
    ),
    api.query(AdminProductsDocument, ({ request, variables }) =>
      respond(request, () => {
        const page = state.listProducts(request.headers.get('x-store-id'), variables);
        return {
          products: {
            ...page,
            __typename: 'ProductPage',
            items: page.items.map((row) => ({ ...row, __typename: 'Product' })),
          },
        };
      }),
    ),
    api.query(AdminProductDocument, ({ request, variables }) =>
      respond(request, () => ({
        product: {
          ...state.getProduct(request.headers.get('x-store-id'), variables.id),
          __typename: 'Product',
        },
      })),
    ),
    api.mutation(AdminCreateProductDocument, ({ request, variables }) =>
      respond(request, () => ({
        createProduct: {
          ...state.createProduct(request.headers.get('x-store-id'), variables.input),
          __typename: 'Product',
        },
      })),
    ),
    api.mutation(AdminUpdateProductDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateProduct: {
          ...state.updateProduct(request.headers.get('x-store-id'), variables.id, variables.input),
          __typename: 'Product',
        },
      })),
    ),
    api.mutation(AdminDeleteProductDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteProduct: {
          ...state.deleteProduct(request.headers.get('x-store-id'), variables.id),
          __typename: 'Product',
        },
      })),
    ),
    api.query(AdminVenuesDocument, ({ request, variables }) =>
      respond(request, () => {
        const page = state.listVenues(request.headers.get('x-store-id'), variables);
        return {
          referenceVenues: {
            ...page,
            __typename: 'ReferenceVenuePage',
            items: page.items.map((row) => ({ ...row, __typename: 'ReferenceVenue' })),
          },
        };
      }),
    ),
    api.query(AdminVenueDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceVenue: {
          ...state.getVenue(request.headers.get('x-store-id'), variables.id),
          __typename: 'ReferenceVenue',
        },
      })),
    ),
    api.mutation(AdminCreateVenueDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceVenue: {
          ...state.createVenue(request.headers.get('x-store-id'), variables.input),
          __typename: 'ReferenceVenue',
        },
      })),
    ),
    api.mutation(AdminUpdateVenueDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceVenue: {
          ...state.updateVenue(request.headers.get('x-store-id'), variables.id, variables.input),
          __typename: 'ReferenceVenue',
        },
      })),
    ),
    api.mutation(AdminDeleteVenueDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceVenue: {
          ...state.deleteVenue(request.headers.get('x-store-id'), variables.id),
          __typename: 'ReferenceVenue',
        },
      })),
    ),
    api.query(AdminVehiclesDocument, ({ request, variables }) =>
      respond(request, () => {
        const page = state.listVehicles(request.headers.get('x-store-id'), variables);
        return {
          referenceVehicles: {
            ...page,
            __typename: 'ReferenceVehiclePage',
            items: page.items.map((row) => ({ ...row, __typename: 'ReferenceVehicle' })),
          },
        };
      }),
    ),
    api.query(AdminVehicleDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceVehicle: {
          ...state.getVehicle(request.headers.get('x-store-id'), variables.id),
          __typename: 'ReferenceVehicle',
        },
      })),
    ),
    api.mutation(AdminCreateVehicleDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceVehicle: {
          ...state.createVehicle(request.headers.get('x-store-id'), variables.input),
          __typename: 'ReferenceVehicle',
        },
      })),
    ),
    api.mutation(AdminUpdateVehicleDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceVehicle: {
          ...state.updateVehicle(request.headers.get('x-store-id'), variables.id, variables.input),
          __typename: 'ReferenceVehicle',
        },
      })),
    ),
    api.mutation(AdminDeleteVehicleDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceVehicle: {
          ...state.deleteVehicle(request.headers.get('x-store-id'), variables.id),
          __typename: 'ReferenceVehicle',
        },
      })),
    ),
    api.query(AdminSpeakersDocument, ({ request, variables }) =>
      respond(request, () => {
        const page = state.listSpeakers(request.headers.get('x-store-id'), variables);
        return {
          referenceSpeakers: {
            ...page,
            __typename: 'ReferenceSpeakerPage',
            items: page.items.map((row) => ({ ...row, __typename: 'ReferenceSpeaker' })),
          },
        };
      }),
    ),
    api.query(AdminSpeakerDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceSpeaker: {
          ...state.getSpeaker(request.headers.get('x-store-id'), variables.id),
          __typename: 'ReferenceSpeaker',
        },
      })),
    ),
    api.mutation(AdminCreateSpeakerDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceSpeaker: {
          ...state.createSpeaker(request.headers.get('x-store-id'), variables.input),
          __typename: 'ReferenceSpeaker',
        },
      })),
    ),
    api.mutation(AdminUpdateSpeakerDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceSpeaker: {
          ...state.updateSpeaker(request.headers.get('x-store-id'), variables.id, variables.input),
          __typename: 'ReferenceSpeaker',
        },
      })),
    ),
    api.mutation(AdminDeleteSpeakerDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceSpeaker: {
          ...state.deleteSpeaker(request.headers.get('x-store-id'), variables.id),
          __typename: 'ReferenceSpeaker',
        },
      })),
    ),
    api.query(AdminTagsDocument, ({ request, variables }) =>
      respond(request, () => {
        const page = state.listTags(request.headers.get('x-store-id'), variables);
        return {
          referenceTags: {
            ...page,
            __typename: 'ReferenceTagPage',
            items: page.items.map((row) => ({ ...row, __typename: 'ReferenceTag' })),
          },
        };
      }),
    ),
    api.query(AdminTagDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceTag: {
          ...state.getTag(request.headers.get('x-store-id'), variables.id),
          __typename: 'ReferenceTag',
        },
      })),
    ),
    api.mutation(AdminCreateTagDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceTag: {
          ...state.createTag(request.headers.get('x-store-id'), variables.input),
          __typename: 'ReferenceTag',
        },
      })),
    ),
    api.mutation(AdminUpdateTagDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceTag: {
          ...state.updateTag(request.headers.get('x-store-id'), variables.id, variables.input),
          __typename: 'ReferenceTag',
        },
      })),
    ),
    api.mutation(AdminDeleteTagDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceTag: {
          ...state.deleteTag(request.headers.get('x-store-id'), variables.id),
          __typename: 'ReferenceTag',
        },
      })),
    ),
    api.query(AdminMediaDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceEventMedia: state.listMedia(request.headers.get('x-store-id'), variables.eventId),
      })),
    ),
    api.mutation(AdminUploadIntentDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceUploadIntent: state.createUploadIntent(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.input,
        ),
      })),
    ),
    api.mutation(AdminFinalizeUploadDocument, ({ request, variables }) =>
      respond(request, async () => ({
        finalizeReferenceUpload: await state.finalizeUpload(
          request.headers.get('x-store-id'),
          variables.uploadId,
        ),
      })),
    ),
    api.mutation(AdminUpdateMediaDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceEventMedia: state.updateMedia(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(AdminDeleteMediaDocument, ({ request, variables }) =>
      respond(request, async () => ({
        deleteReferenceEventMedia: await state.deleteMedia(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
        ),
      })),
    ),
    api.mutation(AdminMediaCoverDocument, ({ request, variables }) =>
      respond(request, () => ({
        setReferenceEventCover: state.setMediaCover(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
        ),
      })),
    ),
    api.mutation(AdminReorderMediaDocument, ({ request, variables }) =>
      respond(request, () => ({
        reorderReferenceEventMedia: state.reorderMedia(
          request.headers.get('x-store-id'),
          variables.eventId,
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
        ),
      })),
    ),
    http.put(
      new URL('/__prototype/media/uploads/:id', endpoint).href,
      async ({ request, params }) => {
        try {
          await delay(350);
          await state.uploadMedia(params.id, request);
          return new HttpResponse(null, { status: 204 });
        } catch (error) {
          return HttpResponse.json(
            {
              message:
                error instanceof PrototypeError
                  ? error.message
                  : 'Upload failed. Please try again.',
            },
            { status: 400 },
          );
        }
      },
    ),
    http.get(
      new URL('/__prototype/media/files/:storeId/:id', endpoint).href,
      async ({ request, params }) => {
        try {
          const url = new URL(request.url),
            blob = await state.readMedia(
              params.storeId,
              params.id,
              url.searchParams.get('token'),
              url.origin,
            );
          return new HttpResponse(blob, {
            headers: { 'content-type': blob.type, 'cache-control': 'no-store' },
          });
        } catch (error) {
          return HttpResponse.json(
            {
              message: error instanceof PrototypeError ? error.message : 'Image file unavailable.',
            },
            { status: 404, headers: { 'cache-control': 'no-store' } },
          );
        }
      },
    ),
    api.query(AdminEventsDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceEvents: {
          ...state.listEvents(request.headers.get('x-store-id'), variables),
          __typename: 'ReferenceEventPage',
        },
      })),
    ),
    api.query(AdminEventDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceEvent: state.getEvent(
          request.headers.get('x-store-id'),
          variables.id,
          variables.includeDeleted ?? false,
        ),
      })),
    ),
    api.mutation(AdminCreateEventDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceEvent: state.createEvent(request.headers.get('x-store-id'), variables.input),
      })),
    ),
    api.mutation(AdminUpdateEventDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceEvent: state.updateEvent(
          request.headers.get('x-store-id'),
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(AdminSetEventsStatusDocument, ({ request, variables }) =>
      respond(request, () => ({
        setReferenceEventsStatus: state.setEventsStatus(
          request.headers.get('x-store-id'),
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
          variables.status,
        ),
      })),
    ),
    api.mutation(AdminTrashEventsDocument, ({ request, variables }) =>
      respond(request, () => ({
        trashReferenceEvents: state.trashEvents(
          request.headers.get('x-store-id'),
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
        ),
      })),
    ),
    api.mutation(AdminRestoreEventsDocument, ({ request, variables }) =>
      respond(request, () => ({
        restoreReferenceEvents: state.restoreEvents(
          request.headers.get('x-store-id'),
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
        ),
      })),
    ),
    api.query(AdminEventHistoryDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceEventHistory: state.listEventHistory(request.headers.get('x-store-id'), variables),
      })),
    ),
    api.query(AdminSessionsDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceSessions: state.listSessions(request.headers.get('x-store-id'), variables.eventId),
      })),
    ),
    api.query(AdminSessionDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceSession: state.getSession(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
        ),
      })),
    ),
    api.mutation(AdminCreateSessionDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceSession: state.createSession(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.input,
        ),
      })),
    ),
    api.mutation(AdminUpdateSessionDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceSession: state.updateSession(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(AdminDeleteSessionDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceSession: state.deleteSession(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
        ),
      })),
    ),
    api.mutation(AdminReorderSessionsDocument, ({ request, variables }) =>
      respond(request, () => ({
        reorderReferenceSessions: state.reorderSessions(
          request.headers.get('x-store-id'),
          variables.eventId,
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
        ),
      })),
    ),
    api.operation(() =>
      HttpResponse.json({ errors: [{ message: 'This operation is unavailable in Prototype.' }] }),
    ),
    http.all('*', ({ request }) => {
      const url = new URL(request.url);
      if (
        url.origin !== origin ||
        url.pathname.startsWith('/__prototype/') ||
        url.pathname.endsWith('/graphql')
      )
        return HttpResponse.error();
      return;
    }),
  ];
}
