import type { CreateParams, UpdateParams } from '@refinedev/core';
import type { GraphQLDataProviderOptions } from '@refinedev/graphql';
import type { OperationResult } from '@urql/core';
import { requireData, lookupFilters } from './provider-utils.js';
import {
  CreateReferenceSpeakerDocument,
  DeleteReferenceSpeakerDocument,
  GetReferenceSpeakerDocument,
  ListReferenceSpeakersDocument,
  UpdateReferenceSpeakerDocument,
  type CreateReferenceSpeakerInput,
  type UpdateReferenceSpeakerInput,
  type CreateReferenceSpeakerMutation,
  type CreateReferenceSpeakerMutationVariables,
  type UpdateReferenceSpeakerMutation,
  type UpdateReferenceSpeakerMutationVariables,
  type DeleteReferenceSpeakerMutation,
  type DeleteReferenceSpeakerMutationVariables,
  type GetReferenceSpeakerQuery,
  type GetReferenceSpeakerQueryVariables,
  type ListReferenceSpeakersQuery,
  type ListReferenceSpeakersQueryVariables,
} from '../generated/graphql/operations.js';

export const speakersOptions: GraphQLDataProviderOptions = {
  getList: {
    buildVariables: ({ pagination, filters }): ListReferenceSpeakersQueryVariables => ({
      offset: ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? 20),
      limit: pagination?.pageSize ?? 20,
      ...lookupFilters(filters),
    }),
    dataMapper: (response: OperationResult<ListReferenceSpeakersQuery>) =>
      requireData(response).referenceSpeakers.items,
    getTotalCount: (response: OperationResult<ListReferenceSpeakersQuery>) =>
      requireData(response).referenceSpeakers.total,
  },
  getOne: {
    buildVariables: ({ id }): GetReferenceSpeakerQueryVariables => ({ id: String(id) }),
    dataMapper: (response: OperationResult<GetReferenceSpeakerQuery>) =>
      requireData(response).referenceSpeaker,
  },
  create: {
    buildVariables: ({
      variables,
    }: CreateParams<CreateReferenceSpeakerInput>): CreateReferenceSpeakerMutationVariables => ({
      input: variables,
    }),
    dataMapper: (response: OperationResult<CreateReferenceSpeakerMutation>) =>
      requireData(response).createReferenceSpeaker,
  },
  update: {
    buildVariables: ({
      id,
      variables,
    }: UpdateParams<UpdateReferenceSpeakerInput>): UpdateReferenceSpeakerMutationVariables => ({
      id: String(id),
      input: variables,
    }),
    dataMapper: (response: OperationResult<UpdateReferenceSpeakerMutation>) =>
      requireData(response).updateReferenceSpeaker,
  },
  deleteOne: {
    buildVariables: ({ id }): DeleteReferenceSpeakerMutationVariables => ({
      id: String(id),
    }),
    dataMapper: (response: OperationResult<DeleteReferenceSpeakerMutation>) =>
      requireData(response).deleteReferenceSpeaker,
  },
};

export const speakersDocuments = {
  list: ListReferenceSpeakersDocument,
  one: GetReferenceSpeakerDocument,
  create: CreateReferenceSpeakerDocument,
  update: UpdateReferenceSpeakerDocument,
  delete: DeleteReferenceSpeakerDocument,
};
