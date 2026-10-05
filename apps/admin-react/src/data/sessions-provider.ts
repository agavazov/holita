import type { CreateParams, UpdateParams } from '@refinedev/core';
import type { GraphQLDataProviderOptions } from '@refinedev/graphql';
import type { OperationResult } from '@urql/core';
import { DataError } from './data-error.js';
import { requireData } from './provider-utils.js';
import {
  CreateReferenceSessionDocument,
  UpdateReferenceSessionDocument,
  DeleteReferenceSessionDocument,
  GetReferenceSessionDocument,
  ListReferenceSessionsDocument,
  type CreateReferenceSessionInput,
  type UpdateReferenceSessionInput,
  type CreateReferenceSessionMutation,
  type UpdateReferenceSessionMutation,
  type DeleteReferenceSessionMutation,
  type GetReferenceSessionQuery,
  type ListReferenceSessionsQuery,
  type ReorderReferenceSessionsMutation,
  type CreateReferenceSessionMutationVariables,
  type UpdateReferenceSessionMutationVariables,
  type DeleteReferenceSessionMutationVariables,
  type GetReferenceSessionQueryVariables,
  type ListReferenceSessionsQueryVariables,
} from '../generated/graphql/operations.js';

export function sessionEventId(resource: string) {
  const match =
    /\/reference\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/sessions$/i.exec(
      resource,
    );
  if (!match?.[1]) throw new DataError('Select a valid event before accessing sessions.');
  return match[1].toLowerCase();
}
export const sessionsOptions: GraphQLDataProviderOptions = {
  getList: {
    buildVariables: ({ resource }): ListReferenceSessionsQueryVariables => ({
      eventId: sessionEventId(resource),
    }),
    dataMapper: (response: OperationResult<ListReferenceSessionsQuery>) =>
      requireData(response).referenceSessions,
    getTotalCount: (response: OperationResult<ListReferenceSessionsQuery>) =>
      requireData(response).referenceSessions.length,
  },
  getOne: {
    buildVariables: ({ resource, id }): GetReferenceSessionQueryVariables => ({
      eventId: sessionEventId(resource),
      id: String(id),
    }),
    dataMapper: (response: OperationResult<GetReferenceSessionQuery>) =>
      requireData(response).referenceSession,
  },
  create: {
    buildVariables: ({
      resource,
      variables,
    }: CreateParams<CreateReferenceSessionInput>): CreateReferenceSessionMutationVariables => ({
      eventId: sessionEventId(resource),
      input: variables,
    }),
    dataMapper: (response: OperationResult<CreateReferenceSessionMutation>) =>
      requireData(response).createReferenceSession,
  },
  update: {
    buildVariables: ({
      resource,
      id,
      variables,
    }: UpdateParams<UpdateReferenceSessionInput>): UpdateReferenceSessionMutationVariables => ({
      eventId: sessionEventId(resource),
      id: String(id),
      input: variables,
    }),
    dataMapper: (response: OperationResult<UpdateReferenceSessionMutation>) =>
      requireData(response).updateReferenceSession,
  },
  deleteOne: {
    buildVariables: ({ resource, id }): DeleteReferenceSessionMutationVariables => ({
      eventId: sessionEventId(resource),
      id: String(id),
    }),
    dataMapper: (response: OperationResult<DeleteReferenceSessionMutation>) =>
      requireData(response).deleteReferenceSession,
  },
  custom: {
    dataMapper: (response: OperationResult<ReorderReferenceSessionsMutation>) => ({
      items: requireData(response).reorderReferenceSessions,
    }),
  },
};
export const sessionsDocuments = {
  list: ListReferenceSessionsDocument,
  one: GetReferenceSessionDocument,
  create: CreateReferenceSessionDocument,
  update: UpdateReferenceSessionDocument,
  delete: DeleteReferenceSessionDocument,
};
