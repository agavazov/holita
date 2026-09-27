import type { CreateParams, UpdateParams } from '@refinedev/core';
import type { GraphQLDataProviderOptions } from '@refinedev/graphql';
import type { OperationResult } from '@urql/core';
import { requireData, lookupFilters } from './provider-utils.js';
import {
  CreateReferenceVenueDocument,
  DeleteReferenceVenueDocument,
  GetReferenceVenueDocument,
  ListReferenceVenuesDocument,
  UpdateReferenceVenueDocument,
  type CreateReferenceVenueInput,
  type UpdateReferenceVenueInput,
  type CreateReferenceVenueMutation,
  type CreateReferenceVenueMutationVariables,
  type UpdateReferenceVenueMutation,
  type UpdateReferenceVenueMutationVariables,
  type DeleteReferenceVenueMutation,
  type DeleteReferenceVenueMutationVariables,
  type GetReferenceVenueQuery,
  type GetReferenceVenueQueryVariables,
  type ListReferenceVenuesQuery,
  type ListReferenceVenuesQueryVariables,
} from '../generated/graphql/operations.js';

export const venuesOptions: GraphQLDataProviderOptions = {
  getList: {
    buildVariables: ({ pagination, filters }): ListReferenceVenuesQueryVariables => ({
      offset: ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? 20),
      limit: pagination?.pageSize ?? 20,
      ...lookupFilters(filters),
    }),
    dataMapper: (response: OperationResult<ListReferenceVenuesQuery>) =>
      requireData(response).referenceVenues.items,
    getTotalCount: (response: OperationResult<ListReferenceVenuesQuery>) =>
      requireData(response).referenceVenues.total,
  },
  getOne: {
    buildVariables: ({ id }): GetReferenceVenueQueryVariables => ({ id: String(id) }),
    dataMapper: (response: OperationResult<GetReferenceVenueQuery>) =>
      requireData(response).referenceVenue,
  },
  create: {
    buildVariables: ({
      variables,
    }: CreateParams<CreateReferenceVenueInput>): CreateReferenceVenueMutationVariables => ({
      input: variables,
    }),
    dataMapper: (response: OperationResult<CreateReferenceVenueMutation>) =>
      requireData(response).createReferenceVenue,
  },
  update: {
    buildVariables: ({
      id,
      variables,
    }: UpdateParams<UpdateReferenceVenueInput>): UpdateReferenceVenueMutationVariables => ({
      id: String(id),
      input: variables,
    }),
    dataMapper: (response: OperationResult<UpdateReferenceVenueMutation>) =>
      requireData(response).updateReferenceVenue,
  },
  deleteOne: {
    buildVariables: ({ id }): DeleteReferenceVenueMutationVariables => ({
      id: String(id),
    }),
    dataMapper: (response: OperationResult<DeleteReferenceVenueMutation>) =>
      requireData(response).deleteReferenceVenue,
  },
};

export const venuesDocuments = {
  list: ListReferenceVenuesDocument,
  one: GetReferenceVenueDocument,
  create: CreateReferenceVenueDocument,
  update: UpdateReferenceVenueDocument,
  delete: DeleteReferenceVenueDocument,
};
