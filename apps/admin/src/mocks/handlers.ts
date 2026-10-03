import { delay, http, HttpResponse } from 'msw';
import { graphql, type GraphQLResponseBody } from 'msw/graphql';
import { DataError } from '../data/data-error.js';
import {
  ListReferenceEventsDocument,
  GetReferenceEventDocument,
  CreateReferenceEventDocument,
  UpdateReferenceEventDocument,
  DeleteReferenceEventDocument,
  SetReferenceEventsStatusDocument,
  TrashReferenceEventsDocument,
  RestoreReferenceEventsDocument,
  ListReferenceEventHistoryDocument,
  ListReferenceSessionsDocument,
  GetReferenceSessionDocument,
  CreateReferenceSessionDocument,
  UpdateReferenceSessionDocument,
  DeleteReferenceSessionDocument,
  ReorderReferenceSessionsDocument,
  ListStoresDocument,
  ListProductsDocument,
  GetProductDocument,
  CreateProductDocument,
  UpdateProductDocument,
  DeleteProductDocument,
  ListReferenceVenuesDocument,
  GetReferenceVenueDocument,
  CreateReferenceVenueDocument,
  UpdateReferenceVenueDocument,
  DeleteReferenceVenueDocument,
  ListReferenceSpeakersDocument,
  GetReferenceSpeakerDocument,
  CreateReferenceSpeakerDocument,
  UpdateReferenceSpeakerDocument,
  DeleteReferenceSpeakerDocument,
  ListReferenceTagsDocument,
  GetReferenceTagDocument,
  CreateReferenceTagDocument,
  UpdateReferenceTagDocument,
  DeleteReferenceTagDocument,
  ListReferenceEventMediaDocument,
  CreateReferenceUploadIntentDocument,
  FinalizeReferenceUploadDocument,
  UpdateReferenceEventMediaDocument,
  DeleteReferenceEventMediaDocument,
  SetReferenceEventCoverDocument,
  ReorderReferenceEventMediaDocument,
} from '../generated/graphql/operations.js';
import type { PrototypeState } from './state.js';

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
            error instanceof DataError
              ? error.message
              : 'Prototype request failed. Reload and try again.',
          extensions: {
            requestId: request.headers.get('x-request-id'),
            fieldErrors: error instanceof DataError ? error.fieldErrors : [],
          },
        },
      ],
    });
  }
}

export function createPrototypeHandlers(endpoint: string, state: PrototypeState) {
  const api = graphql.link(endpoint);
  return [
    api.query(ListReferenceEventMediaDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceEventMedia: state.listMedia(request.headers.get('x-store-id'), variables.eventId),
      })),
    ),
    api.mutation(CreateReferenceUploadIntentDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceUploadIntent: state.createUploadIntent(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.input,
        ),
      })),
    ),
    api.mutation(FinalizeReferenceUploadDocument, ({ request, variables }) =>
      respond(request, async () => ({
        finalizeReferenceUpload: await state.finalizeUpload(
          request.headers.get('x-store-id'),
          variables.uploadId,
        ),
      })),
    ),
    api.mutation(UpdateReferenceEventMediaDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceEventMedia: state.updateMedia(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(DeleteReferenceEventMediaDocument, ({ request, variables }) =>
      respond(request, async () => ({
        deleteReferenceEventMedia: await state.deleteMedia(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
        ),
      })),
    ),
    api.mutation(SetReferenceEventCoverDocument, ({ request, variables }) =>
      respond(request, () => ({
        setReferenceEventCover: state.setMediaCover(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
        ),
      })),
    ),
    api.mutation(ReorderReferenceEventMediaDocument, ({ request, variables }) =>
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
                error instanceof DataError ? error.message : 'Upload failed. Please try again.',
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
            { message: error instanceof DataError ? error.message : 'Image file unavailable.' },
            { status: 404, headers: { 'cache-control': 'no-store' } },
          );
        }
      },
    ),
    api.query(ListStoresDocument, ({ request }) =>
      respond(request, () => ({ stores: state.listStores() })),
    ),
    api.query(ListProductsDocument, ({ request, variables }) =>
      respond(request, () => ({
        products: state.listProducts(request.headers.get('x-store-id'), variables),
      })),
    ),
    api.query(GetProductDocument, ({ request, variables }) =>
      respond(request, () => ({
        product: state.getProduct(request.headers.get('x-store-id'), variables.id),
      })),
    ),
    api.mutation(CreateProductDocument, ({ request, variables }) =>
      respond(request, () => ({
        createProduct: state.createProduct(request.headers.get('x-store-id'), variables.input),
      })),
    ),
    api.mutation(UpdateProductDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateProduct: state.updateProduct(
          request.headers.get('x-store-id'),
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(DeleteProductDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteProduct: state.deleteProduct(request.headers.get('x-store-id'), variables.id),
      })),
    ),
    api.query(ListReferenceVenuesDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceVenues: state.listVenues(request.headers.get('x-store-id'), variables),
      })),
    ),
    api.query(GetReferenceVenueDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceVenue: state.getVenue(request.headers.get('x-store-id'), variables.id),
      })),
    ),
    api.mutation(CreateReferenceVenueDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceVenue: state.createVenue(request.headers.get('x-store-id'), variables.input),
      })),
    ),
    api.mutation(UpdateReferenceVenueDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceVenue: state.updateVenue(
          request.headers.get('x-store-id'),
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(DeleteReferenceVenueDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceVenue: state.deleteVenue(request.headers.get('x-store-id'), variables.id),
      })),
    ),
    api.query(ListReferenceSpeakersDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceSpeakers: state.listSpeakers(request.headers.get('x-store-id'), variables),
      })),
    ),
    api.query(GetReferenceSpeakerDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceSpeaker: state.getSpeaker(request.headers.get('x-store-id'), variables.id),
      })),
    ),
    api.mutation(CreateReferenceSpeakerDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceSpeaker: state.createSpeaker(
          request.headers.get('x-store-id'),
          variables.input,
        ),
      })),
    ),
    api.mutation(UpdateReferenceSpeakerDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceSpeaker: state.updateSpeaker(
          request.headers.get('x-store-id'),
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(DeleteReferenceSpeakerDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceSpeaker: state.deleteSpeaker(
          request.headers.get('x-store-id'),
          variables.id,
        ),
      })),
    ),
    api.query(ListReferenceTagsDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceTags: state.listTags(request.headers.get('x-store-id'), variables),
      })),
    ),
    api.query(GetReferenceTagDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceTag: state.getTag(request.headers.get('x-store-id'), variables.id),
      })),
    ),
    api.mutation(CreateReferenceTagDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceTag: state.createTag(request.headers.get('x-store-id'), variables.input),
      })),
    ),
    api.mutation(UpdateReferenceTagDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceTag: state.updateTag(
          request.headers.get('x-store-id'),
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(DeleteReferenceTagDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceTag: state.deleteTag(request.headers.get('x-store-id'), variables.id),
      })),
    ),
    api.query(ListReferenceEventsDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceEvents: state.listEvents(request.headers.get('x-store-id'), variables),
      })),
    ),
    api.query(GetReferenceEventDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceEvent: state.getEvent(
          request.headers.get('x-store-id'),
          variables.id,
          variables.includeDeleted ?? false,
        ),
      })),
    ),
    api.mutation(CreateReferenceEventDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceEvent: state.createEvent(request.headers.get('x-store-id'), variables.input),
      })),
    ),
    api.mutation(UpdateReferenceEventDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceEvent: state.updateEvent(
          request.headers.get('x-store-id'),
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(DeleteReferenceEventDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceEvent: state.deleteEvent(request.headers.get('x-store-id'), variables.id),
      })),
    ),
    api.mutation(SetReferenceEventsStatusDocument, ({ request, variables }) =>
      respond(request, () => ({
        setReferenceEventsStatus: state.setEventsStatus(
          request.headers.get('x-store-id'),
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
          variables.status,
        ),
      })),
    ),
    api.mutation(TrashReferenceEventsDocument, ({ request, variables }) =>
      respond(request, () => ({
        trashReferenceEvents: state.trashEvents(
          request.headers.get('x-store-id'),
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
        ),
      })),
    ),
    api.mutation(RestoreReferenceEventsDocument, ({ request, variables }) =>
      respond(request, () => ({
        restoreReferenceEvents: state.restoreEvents(
          request.headers.get('x-store-id'),
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
        ),
      })),
    ),
    api.query(ListReferenceEventHistoryDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceEventHistory: state.listEventHistory(request.headers.get('x-store-id'), variables),
      })),
    ),
    api.query(ListReferenceSessionsDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceSessions: state.listSessions(request.headers.get('x-store-id'), variables.eventId),
      })),
    ),
    api.query(GetReferenceSessionDocument, ({ request, variables }) =>
      respond(request, () => ({
        referenceSession: state.getSession(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
        ),
      })),
    ),
    api.mutation(CreateReferenceSessionDocument, ({ request, variables }) =>
      respond(request, () => ({
        createReferenceSession: state.createSession(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.input,
        ),
      })),
    ),
    api.mutation(UpdateReferenceSessionDocument, ({ request, variables }) =>
      respond(request, () => ({
        updateReferenceSession: state.updateSession(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
          variables.input,
        ),
      })),
    ),
    api.mutation(DeleteReferenceSessionDocument, ({ request, variables }) =>
      respond(request, () => ({
        deleteReferenceSession: state.deleteSession(
          request.headers.get('x-store-id'),
          variables.eventId,
          variables.id,
        ),
      })),
    ),
    api.mutation(ReorderReferenceSessionsDocument, ({ request, variables }) =>
      respond(request, () => ({
        reorderReferenceSessions: state.reorderSessions(
          request.headers.get('x-store-id'),
          variables.eventId,
          Array.isArray(variables.ids) ? variables.ids : [variables.ids],
        ),
      })),
    ),
    api.operation(() =>
      HttpResponse.json({
        errors: [{ message: 'This operation is unavailable in Prototype.' }],
      }),
    ),
  ];
}
