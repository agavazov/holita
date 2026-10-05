import type { CrudFilters, CreateParams, UpdateParams } from '@refinedev/core';
import type { GraphQLDataProviderOptions } from '@refinedev/graphql';
import type { OperationResult } from '@urql/core';
import { DataError } from './data-error.js';
import { requireData } from './provider-utils.js';
import {
  SetReferenceEventsStatusDocument,
  TrashReferenceEventsDocument,
  RestoreReferenceEventsDocument,
  type SetReferenceEventsStatusMutation,
  type TrashReferenceEventsMutation,
  type RestoreReferenceEventsMutation,
  type ReferenceEventStatus,
  CreateReferenceEventDocument,
  DeleteReferenceEventDocument,
  GetReferenceEventDocument,
  ListReferenceEventsDocument,
  UpdateReferenceEventDocument,
  type CreateReferenceEventInput,
  type UpdateReferenceEventInput,
  type CreateReferenceEventMutation,
  type CreateReferenceEventMutationVariables,
  type UpdateReferenceEventMutation,
  type UpdateReferenceEventMutationVariables,
  type DeleteReferenceEventMutation,
  type DeleteReferenceEventMutationVariables,
  type GetReferenceEventQuery,
  type GetReferenceEventQueryVariables,
  type ListReferenceEventsQuery,
  type ListReferenceEventsQueryVariables,
  type ReferenceEventFilter,
  type ReferenceEventSortField,
} from '../generated/graphql/operations.js';

const sortFields: Record<string, ReferenceEventSortField> = {
  title: 'TITLE',
  startsAt: 'STARTS_AT',
  status: 'STATUS',
  capacity: 'CAPACITY',
  budget: 'BUDGET',
  createdAt: 'CREATED_AT',
};
function eventFilters(filters?: CrudFilters): ReferenceEventFilter {
  const result: ReferenceEventFilter = {};
  for (const filter of filters ?? []) {
    if (!('field' in filter)) continue;
    const value: unknown = filter.value;
    const field = filter.field;
    if (
      (field === 'search' || field === 'startsAtFrom' || field === 'startsAtBefore') &&
      typeof value === 'string'
    )
      result[field] = value;
    if ((field === 'capacityMin' || field === 'capacityMax') && typeof value === 'number')
      result[field] = value;
    if ((field === 'featured' || field === 'trashed') && typeof value === 'boolean')
      result[field] = value;
    if (Array.isArray(value)) {
      if (
        (field === 'venueIds' || field === 'tagIds') &&
        value.every((item: unknown) => typeof item === 'string')
      )
        result[field] = value;
      if (field === 'statuses')
        result.statuses = value.filter(
          (item: unknown): item is 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' =>
            item === 'DRAFT' || item === 'PUBLISHED' || item === 'ARCHIVED',
        );
      if (field === 'formats')
        result.formats = value.filter(
          (item: unknown): item is 'IN_PERSON' | 'ONLINE' | 'HYBRID' =>
            item === 'IN_PERSON' || item === 'ONLINE' || item === 'HYBRID',
        );
    }
  }
  return result;
}
export type EventAction =
  | { action: 'trash' | 'restore'; ids: string[] }
  | { action: 'status'; ids: string[]; status: ReferenceEventStatus };
type EventActionData =
  SetReferenceEventsStatusMutation | TrashReferenceEventsMutation | RestoreReferenceEventsMutation;
export const eventsOptions: GraphQLDataProviderOptions = {
  custom: {
    dataMapper: (response: OperationResult<EventActionData>) => {
      const data = requireData(response);
      if ('setReferenceEventsStatus' in data) return data.setReferenceEventsStatus;
      if ('trashReferenceEvents' in data) return data.trashReferenceEvents;
      return data.restoreReferenceEvents;
    },
  },
  getList: {
    buildVariables: ({ pagination, filters, sorters }): ListReferenceEventsQueryVariables => ({
      offset: ((pagination?.currentPage ?? 1) - 1) * (pagination?.pageSize ?? 20),
      limit: pagination?.pageSize ?? 20,
      filter: eventFilters(filters),
      sort: {
        field: sortFields[sorters?.[0]?.field ?? 'startsAt'] ?? 'STARTS_AT',
        direction: sorters?.[0]?.order === 'desc' ? 'DESC' : 'ASC',
      },
    }),
    dataMapper: (response: OperationResult<ListReferenceEventsQuery>) =>
      requireData(response).referenceEvents.items,
    getTotalCount: (response: OperationResult<ListReferenceEventsQuery>) =>
      requireData(response).referenceEvents.total,
  },
  getOne: {
    buildVariables: ({ id, meta }): GetReferenceEventQueryVariables => ({
      id: String(id),
      ...(meta?.includeDeleted === true ? { includeDeleted: true } : {}),
    }),
    dataMapper: (response: OperationResult<GetReferenceEventQuery>) =>
      requireData(response).referenceEvent,
  },
  create: {
    buildVariables: ({
      variables,
    }: CreateParams<CreateReferenceEventInput>): CreateReferenceEventMutationVariables => ({
      input: variables,
    }),
    dataMapper: (response: OperationResult<CreateReferenceEventMutation>) =>
      requireData(response).createReferenceEvent,
  },
  update: {
    buildVariables: ({
      id,
      variables,
    }: UpdateParams<UpdateReferenceEventInput>): UpdateReferenceEventMutationVariables => ({
      id: String(id),
      input: variables,
    }),
    dataMapper: (response: OperationResult<UpdateReferenceEventMutation>) =>
      requireData(response).updateReferenceEvent,
  },
  deleteOne: {
    buildVariables: ({ id }): DeleteReferenceEventMutationVariables => ({
      id: String(id),
    }),
    dataMapper: (response: OperationResult<DeleteReferenceEventMutation>) =>
      requireData(response).deleteReferenceEvent,
  },
};

export const eventsDocuments = {
  list: ListReferenceEventsDocument,
  one: GetReferenceEventDocument,
  create: CreateReferenceEventDocument,
  update: UpdateReferenceEventDocument,
  delete: DeleteReferenceEventDocument,
};

export function eventMutation(payload: unknown) {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('action' in payload) ||
    !('ids' in payload) ||
    !Array.isArray(payload.ids) ||
    !payload.ids.every((id: unknown) => typeof id === 'string')
  )
    throw new DataError('Choose events for this action.');
  if (payload.action === 'trash')
    return { document: TrashReferenceEventsDocument, variables: { ids: payload.ids } };
  if (payload.action === 'restore')
    return { document: RestoreReferenceEventsDocument, variables: { ids: payload.ids } };
  if (
    payload.action === 'status' &&
    'status' in payload &&
    (payload.status === 'DRAFT' || payload.status === 'PUBLISHED' || payload.status === 'ARCHIVED')
  )
    return {
      document: SetReferenceEventsStatusDocument,
      variables: { ids: payload.ids, status: payload.status },
    };
  throw new DataError('Choose a supported event action.');
}
