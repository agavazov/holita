import type { UpdateParams } from '@refinedev/core';
import type { GraphQLDataProviderOptions } from '@refinedev/graphql';
import type { OperationResult } from '@urql/core';
import {
  ListReferenceEventMediaDocument,
  CreateReferenceUploadIntentDocument,
  FinalizeReferenceUploadDocument,
  UpdateReferenceEventMediaDocument,
  DeleteReferenceEventMediaDocument,
  SetReferenceEventCoverDocument,
  ReorderReferenceEventMediaDocument,
  type ListReferenceEventMediaQuery,
  type UpdateReferenceEventMediaInput,
  type UpdateReferenceEventMediaMutation,
  type DeleteReferenceEventMediaMutation,
  type CreateReferenceUploadIntentMutation,
  type FinalizeReferenceUploadMutation,
  type SetReferenceEventCoverMutation,
  type ReorderReferenceEventMediaMutation,
  type CreateReferenceUploadInput,
} from '../generated/graphql/operations.js';
import { DataError } from './data-error.js';
import { requireData } from './provider-utils.js';

export type MediaAction =
  | { action: 'intent'; input: CreateReferenceUploadInput }
  | { action: 'finalize'; uploadId: string }
  | { action: 'cover'; id: string }
  | { action: 'reorder'; ids: string[] };
type CustomData =
  | CreateReferenceUploadIntentMutation
  | FinalizeReferenceUploadMutation
  | SetReferenceEventCoverMutation
  | ReorderReferenceEventMediaMutation;
export function mediaEventId(resource: string) {
  const match =
    /\/reference\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/media$/i.exec(
      resource,
    );
  if (!match?.[1]) throw new DataError('Select a valid event before accessing its gallery.');
  return match[1].toLowerCase();
}
function customData(response: OperationResult<CustomData>) {
  const data = requireData(response);
  if ('createReferenceUploadIntent' in data) return { intent: data.createReferenceUploadIntent };
  if ('finalizeReferenceUpload' in data) return { image: data.finalizeReferenceUpload };
  if ('setReferenceEventCover' in data) return { items: data.setReferenceEventCover };
  return { items: data.reorderReferenceEventMedia };
}
export type MediaResult = ReturnType<typeof customData>;
export const mediaOptions: GraphQLDataProviderOptions = {
  getList: {
    buildVariables: ({ resource }) => ({ eventId: mediaEventId(resource) }),
    dataMapper: (response: OperationResult<ListReferenceEventMediaQuery>) =>
      requireData(response).referenceEventMedia,
    getTotalCount: (response: OperationResult<ListReferenceEventMediaQuery>) =>
      requireData(response).referenceEventMedia.length,
  },
  update: {
    buildVariables: ({
      resource,
      id,
      variables,
    }: UpdateParams<UpdateReferenceEventMediaInput>) => ({
      eventId: mediaEventId(resource),
      id: String(id),
      input: variables,
    }),
    dataMapper: (response: OperationResult<UpdateReferenceEventMediaMutation>) =>
      requireData(response).updateReferenceEventMedia,
  },
  deleteOne: {
    buildVariables: ({ resource, id }) => ({ eventId: mediaEventId(resource), id: String(id) }),
    dataMapper: (response: OperationResult<DeleteReferenceEventMediaMutation>) => ({
      id: requireData(response).deleteReferenceEventMedia,
    }),
  },
  custom: { dataMapper: customData },
};
export const mediaDocuments = {
  list: ListReferenceEventMediaDocument,
  one: undefined,
  create: undefined,
  update: UpdateReferenceEventMediaDocument,
  delete: DeleteReferenceEventMediaDocument,
};
export function mediaMutation(resource: string, payload: unknown) {
  const eventId = mediaEventId(resource);
  if (typeof payload === 'object' && payload !== null && 'action' in payload) {
    if (
      payload.action === 'intent' &&
      'input' in payload &&
      typeof payload.input === 'object' &&
      payload.input !== null &&
      'originalName' in payload.input &&
      typeof payload.input.originalName === 'string' &&
      'contentType' in payload.input &&
      typeof payload.input.contentType === 'string' &&
      'byteSize' in payload.input &&
      typeof payload.input.byteSize === 'number'
    ) {
      return {
        document: CreateReferenceUploadIntentDocument,
        variables: {
          eventId,
          input: {
            originalName: payload.input.originalName,
            contentType: payload.input.contentType,
            byteSize: payload.input.byteSize,
          },
        },
      };
    }
    if (
      payload.action === 'finalize' &&
      'uploadId' in payload &&
      typeof payload.uploadId === 'string'
    )
      return {
        document: FinalizeReferenceUploadDocument,
        variables: { uploadId: payload.uploadId },
      };
    if (payload.action === 'cover' && 'id' in payload && typeof payload.id === 'string')
      return { document: SetReferenceEventCoverDocument, variables: { eventId, id: payload.id } };
    if (
      payload.action === 'reorder' &&
      'ids' in payload &&
      Array.isArray(payload.ids) &&
      payload.ids.every((id: unknown) => typeof id === 'string')
    )
      return {
        document: ReorderReferenceEventMediaDocument,
        variables: { eventId, ids: payload.ids },
      };
  }
  throw new DataError('Provide a valid gallery action.');
}
