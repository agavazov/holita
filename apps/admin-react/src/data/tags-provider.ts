import type { CreateParams, UpdateParams } from '@refinedev/core';
import type { GraphQLDataProviderOptions } from '@refinedev/graphql';
import type { OperationResult } from '@urql/core';
import { requireData, lookupFilters } from './provider-utils.js';
import {
  CreateReferenceTagDocument,
  DeleteReferenceTagDocument,
  GetReferenceTagDocument,
  ListReferenceTagsDocument,
  UpdateReferenceTagDocument,
  type CreateReferenceTagInput,
  type UpdateReferenceTagInput,
  type CreateReferenceTagMutation,
  type CreateReferenceTagMutationVariables,
  type UpdateReferenceTagMutation,
  type UpdateReferenceTagMutationVariables,
  type DeleteReferenceTagMutation,
  type DeleteReferenceTagMutationVariables,
  type GetReferenceTagQuery,
  type GetReferenceTagQueryVariables,
  type ListReferenceTagsQuery,
  type ListReferenceTagsQueryVariables,
  type ReferenceTagSortField,
} from '../generated/graphql/operations.js';

const tagSortFields: Record<string, ReferenceTagSortField> = {
  name: 'NAME',
  color: 'COLOR',
  active: 'ACTIVE',
};

export const tagsOptions: GraphQLDataProviderOptions = {
  getList: {
    buildVariables: ({ pagination, filters, sorters }): ListReferenceTagsQueryVariables => {
      const sorter = sorters?.[0];
      const field = sorter && tagSortFields[sorter.field];
      return {
        offset: ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? 20),
        limit: pagination?.pageSize ?? 20,
        ...lookupFilters(filters),
        ...(field ? { sort: { field, direction: sorter.order === 'asc' ? 'ASC' : 'DESC' } } : {}),
      };
    },
    dataMapper: (response: OperationResult<ListReferenceTagsQuery>) =>
      requireData(response).referenceTags.items,
    getTotalCount: (response: OperationResult<ListReferenceTagsQuery>) =>
      requireData(response).referenceTags.total,
  },
  getOne: {
    buildVariables: ({ id }): GetReferenceTagQueryVariables => ({ id: String(id) }),
    dataMapper: (response: OperationResult<GetReferenceTagQuery>) =>
      requireData(response).referenceTag,
  },
  create: {
    buildVariables: ({
      variables,
    }: CreateParams<CreateReferenceTagInput>): CreateReferenceTagMutationVariables => ({
      input: variables,
    }),
    dataMapper: (response: OperationResult<CreateReferenceTagMutation>) =>
      requireData(response).createReferenceTag,
  },
  update: {
    buildVariables: ({
      id,
      variables,
    }: UpdateParams<UpdateReferenceTagInput>): UpdateReferenceTagMutationVariables => ({
      id: String(id),
      input: variables,
    }),
    dataMapper: (response: OperationResult<UpdateReferenceTagMutation>) =>
      requireData(response).updateReferenceTag,
  },
  deleteOne: {
    buildVariables: ({ id }): DeleteReferenceTagMutationVariables => ({
      id: String(id),
    }),
    dataMapper: (response: OperationResult<DeleteReferenceTagMutation>) =>
      requireData(response).deleteReferenceTag,
  },
};

export const tagsDocuments = {
  list: ListReferenceTagsDocument,
  one: GetReferenceTagDocument,
  create: CreateReferenceTagDocument,
  update: UpdateReferenceTagDocument,
  delete: DeleteReferenceTagDocument,
};
