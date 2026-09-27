import type { GraphQLDataProviderOptions } from '@refinedev/graphql';
import type { OperationResult } from '@urql/core';
import {
  ListReferenceEventHistoryDocument,
  type ListReferenceEventHistoryQuery,
} from '../generated/graphql/operations.js';
import { requireData } from './provider-utils.js';
import { DataError } from './data-error.js';

export const historyOptions: GraphQLDataProviderOptions = {
  getList: {
    buildVariables: ({ resource, pagination }) => {
      const eventId = resource.split('/').at(-2);
      if (!eventId) throw new DataError('Select an event to read its history.');
      return {
        eventId,
        offset: ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? 20),
        limit: pagination?.pageSize ?? 20,
      };
    },
    dataMapper: (response: OperationResult<ListReferenceEventHistoryQuery>) =>
      requireData(response).referenceEventHistory.items,
    getTotalCount: (response: OperationResult<ListReferenceEventHistoryQuery>) =>
      requireData(response).referenceEventHistory.total,
  },
};
export const historyDocuments = {
  list: ListReferenceEventHistoryDocument,
  one: undefined,
  create: undefined,
  update: undefined,
  delete: undefined,
};
