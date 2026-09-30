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
  type ReferenceSpeakerSortField,
} from '../generated/graphql/operations.js';

const speakerSortFields: Record<string, ReferenceSpeakerSortField> = {
  name: 'NAME',
  email: 'EMAIL',
  active: 'ACTIVE',
};

export const speakersOptions: GraphQLDataProviderOptions = {
  getList: {
    buildVariables: ({ pagination, filters, sorters }): ListReferenceSpeakersQueryVariables => {
      const sorter = sorters?.[0];
      const field = sorter && speakerSortFields[sorter.field];
      return {
        offset: ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? 20),
        limit: pagination?.pageSize ?? 20,
        ...lookupFilters(filters),
        ...(field ? { sort: { field, direction: sorter.order === 'asc' ? 'ASC' : 'DESC' } } : {}),
      };
    },
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
