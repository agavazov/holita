import { DataError } from '../data/data-error.js';
import type {
  CreateReferenceEventInput,
  UpdateReferenceEventInput,
  ListReferenceEventsQueryVariables,
  ListReferenceEventHistoryQueryVariables,
  ReferenceEventDetailsFragment,
  ReferenceEventStatus,
} from '../generated/graphql/operations.js';
import type { PrototypeEvent, PrototypePersistence, PrototypeSnapshot } from './snapshot.js';
import { eventFields, eventFormat, eventStatus } from './event-validation.js';
import { eventHistoryValues, historyChanges, recordHistory } from './event-history.js';
import {
  boolean,
  capacity,
  direction,
  ids,
  instant,
  invalid,
  optionalText,
  pagination,
  requireStore,
  uuid,
} from './validation.js';

export function findEvent(
  snapshot: PrototypeSnapshot,
  storeId: string,
  id: unknown,
  includeDeleted = false,
): PrototypeEvent {
  const recordId = uuid(id, 'id');
  const row = snapshot.events.find(
    (event) =>
      event.storeId === storeId && event.id === recordId && (includeDeleted || !event.deletedAt),
  );
  if (!row) throw new DataError('Event not found');
  return row;
}
export function eventResult(
  snapshot: PrototypeSnapshot,
  row: PrototypeEvent,
): ReferenceEventDetailsFragment {
  const tags = snapshot.tags
    .filter((tag) => tag.storeId === row.storeId && row.tagIds.includes(tag.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    ...row,
    tagIds: tags.map((tag) => tag.id),
    tags,
    venue:
      snapshot.venues.find((venue) => venue.storeId === row.storeId && venue.id === row.venueId) ??
      null,
  };
}
function relations(snapshot: PrototypeSnapshot, row: PrototypeEvent, previous?: PrototypeEvent) {
  if (
    row.venueId &&
    row.venueId !== previous?.venueId &&
    !snapshot.venues.some(
      (venue) => venue.storeId === row.storeId && venue.id === row.venueId && venue.active,
    )
  )
    invalid('venueId', 'Choose an active venue in this store.');
  const added = row.tagIds.filter((id) => !previous?.tagIds.includes(id));
  if (
    added.some(
      (id) =>
        !snapshot.tags.some((tag) => tag.id === id && tag.storeId === row.storeId && tag.active),
    )
  )
    invalid('tagIds', 'Choose active tags in this store.');
}
function unique(snapshot: PrototypeSnapshot, row: PrototypeEvent) {
  if (
    snapshot.events.some(
      (event) => event.storeId === row.storeId && event.code === row.code && event.id !== row.id,
    )
  )
    invalid('code', 'Code is already used in this store.');
}
export function writableEvent(snapshot: PrototypeSnapshot, storeId: string, id: unknown) {
  const recordId = uuid(id, 'id');
  if (!snapshot.events.some((row) => row.storeId === storeId && row.id === recordId))
    throw new DataError('One or more events were not found');
  return findEvent(snapshot, storeId, recordId);
}
export function createEventState({ read, write }: PrototypePersistence) {
  function bulk(
    storeValue: unknown,
    values: unknown,
    action: 'status' | 'trash' | 'restore',
    status?: ReferenceEventStatus,
  ) {
    const storeId = uuid(storeValue, 'x-store-id'),
      selected = ids(values, 'ids'),
      snapshot = read();
    if (!selected.length) invalid('ids', 'Choose at least one event.');
    const rows = snapshot.events.filter(
      (row) => row.storeId === storeId && selected.includes(row.id),
    );
    if (rows.length !== selected.length) throw new DataError('One or more events were not found');
    if (rows.some((row) => Boolean(row.deletedAt) !== (action === 'restore')))
      throw new DataError('The selection changed. Refresh the list and select events again.');
    const nextStatus = action === 'status' ? eventStatus(status) : undefined;
    const now = new Date().toISOString();
    snapshot.events = snapshot.events.map((row) => {
      if (!selected.includes(row.id) || row.storeId !== storeId) return row;
      if (nextStatus === row.status) return row;
      const updated = {
        ...row,
        ...(nextStatus ? { status: nextStatus } : { deletedAt: action === 'trash' ? now : null }),
        updatedAt: now,
      };
      if (action !== 'status' || updated.status !== row.status)
        recordHistory(
          snapshot,
          storeId,
          row.id,
          action === 'trash' ? 'TRASHED' : action === 'restore' ? 'RESTORED' : 'UPDATED',
          action === 'status'
            ? historyChanges({ status: row.status }, { status: updated.status })
            : [],
        );
      return updated;
    });
    write(snapshot);
    return { ids: selected, count: selected.length };
  }
  return {
    listEvents: (storeValue: unknown, args: ListReferenceEventsQueryVariables) => {
      const storeId = uuid(storeValue, 'x-store-id'),
        { offset, limit } = pagination(args),
        filter = args.filter ?? {};
      const search = optionalText(filter.search, 'search', 200)?.toLowerCase();
      const statuses = filter.statuses?.map(eventStatus),
        formats = filter.formats?.map(eventFormat);
      const venues = filter.venueIds == null ? [] : ids(filter.venueIds, 'venueIds'),
        tags = filter.tagIds == null ? [] : ids(filter.tagIds, 'tagIds');
      const trashed = filter.trashed == null ? false : boolean(filter.trashed, 'trashed');
      if (filter.featured != null) boolean(filter.featured, 'featured');
      const from =
          filter.startsAtFrom == null ? null : instant(filter.startsAtFrom, 'startsAtFrom'),
        before =
          filter.startsAtBefore == null ? null : instant(filter.startsAtBefore, 'startsAtBefore');
      if (from && before && from >= before)
        invalid('startsAtBefore', 'The end boundary must be after the start.');
      const min = capacity(filter.capacityMin, 'capacityMin'),
        max = capacity(filter.capacityMax, 'capacityMax');
      if (min && max && min > max)
        invalid('capacityMax', 'Maximum capacity must be at least the minimum.');
      const field = args.sort?.field ?? 'STARTS_AT',
        order = direction(args.sort?.direction ?? 'ASC');
      if (!['TITLE', 'STARTS_AT', 'STATUS', 'CAPACITY', 'BUDGET', 'CREATED_AT'].includes(field))
        invalid('sort', 'Choose a supported sort.');
      const snapshot = read(),
        rows = snapshot.events.filter(
          (row) =>
            row.storeId === storeId &&
            Boolean(row.deletedAt) === trashed &&
            (!search ||
              row.title.toLowerCase().includes(search) ||
              row.code.toLowerCase().includes(search)) &&
            (!statuses?.length || statuses.includes(row.status)) &&
            (!formats?.length || formats.includes(row.format)) &&
            (!venues.length || (row.venueId != null && venues.includes(row.venueId))) &&
            (!tags.length || row.tagIds.some((id) => tags.includes(id))) &&
            (filter.featured == null || row.featured === filter.featured) &&
            (!from || row.startsAt >= from) &&
            (!before || row.startsAt < before) &&
            (!min || (row.capacity != null && row.capacity >= min)) &&
            (!max || (row.capacity != null && row.capacity <= max)),
        );
      rows.sort((a, b) => {
        let comparison: number;
        if (field === 'CAPACITY' || field === 'BUDGET') {
          const left = field === 'CAPACITY' ? a.capacity : a.budget,
            right = field === 'CAPACITY' ? b.capacity : b.budget;
          if (left == null || right == null)
            return (left == null ? 1 : 0) - (right == null ? 1 : 0) || a.id.localeCompare(b.id);
          if (field === 'BUDGET') {
            const x = BigInt(String(left).replace('.', '')),
              y = BigInt(String(right).replace('.', ''));
            comparison = x < y ? -1 : x > y ? 1 : 0;
          } else comparison = Number(left) - Number(right);
        } else if (field === 'STATUS')
          comparison =
            ['DRAFT', 'PUBLISHED', 'ARCHIVED'].indexOf(a.status) -
            ['DRAFT', 'PUBLISHED', 'ARCHIVED'].indexOf(b.status);
        else
          comparison = (
            field === 'TITLE' ? a.title : field === 'CREATED_AT' ? a.createdAt : a.startsAt
          ).localeCompare(
            field === 'TITLE' ? b.title : field === 'CREATED_AT' ? b.createdAt : b.startsAt,
          );
        return comparison * order || a.id.localeCompare(b.id);
      });
      return {
        items: rows.slice(offset, offset + limit).map((row) => eventResult(snapshot, row)),
        total: rows.length,
        offset,
        limit,
      };
    },
    getEvent: (storeValue: unknown, id: unknown, includeDeleted = false) => {
      const snapshot = read();
      return eventResult(
        snapshot,
        findEvent(snapshot, uuid(storeValue, 'x-store-id'), id, includeDeleted),
      );
    },
    createEvent: (storeValue: unknown, input: CreateReferenceEventInput) => {
      const storeId = uuid(storeValue, 'x-store-id'),
        snapshot = read(),
        now = new Date().toISOString();
      const row: PrototypeEvent = {
        ...eventFields(input),
        id: crypto.randomUUID(),
        storeId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      relations(snapshot, row);
      requireStore(storeId);
      unique(snapshot, row);
      snapshot.events.push(row);
      recordHistory(
        snapshot,
        storeId,
        row.id,
        'CREATED',
        historyChanges({}, { title: row.title, code: row.code }),
      );
      write(snapshot);
      return eventResult(snapshot, row);
    },
    updateEvent: (storeValue: unknown, id: unknown, input: UpdateReferenceEventInput) => {
      if (!Object.keys(input).length)
        throw new DataError('Provide at least one event field to update');
      const snapshot = read(),
        previous = writableEvent(snapshot, uuid(storeValue, 'x-store-id'), id);
      const row: PrototypeEvent = {
        ...previous,
        ...eventFields({ ...previous, ...input, code: previous.code }),
        updatedAt: new Date().toISOString(),
      };
      for (const session of snapshot.sessions.filter(
        (item) => item.storeId === row.storeId && item.eventId === row.id,
      )) {
        if (session.startsAt < row.startsAt)
          invalid(
            'startsAt',
            'Start must include all existing sessions. Update the sessions first.',
          );
        if (session.endsAt > row.endsAt)
          invalid('endsAt', 'End must include all existing sessions. Update the sessions first.');
      }
      relations(snapshot, row, previous);
      const changes = historyChanges(
        eventHistoryValues(eventResult(snapshot, previous)),
        eventHistoryValues(eventResult(snapshot, row)),
      );
      snapshot.events = snapshot.events.map((item) => (item.id === row.id ? row : item));
      if (changes.length) recordHistory(snapshot, row.storeId, row.id, 'UPDATED', changes);
      write(snapshot);
      return eventResult(snapshot, row);
    },
    deleteEvent: (storeValue: unknown, id: unknown) => {
      const storeId = uuid(storeValue, 'x-store-id');
      writableEvent(read(), storeId, id);
      bulk(storeId, [uuid(id, 'id')], 'trash');
      const snapshot = read();
      return eventResult(snapshot, findEvent(snapshot, storeId, id, true));
    },
    setEventsStatus: (storeValue: unknown, values: unknown, status: ReferenceEventStatus) =>
      bulk(storeValue, values, 'status', status),
    trashEvents: (storeValue: unknown, values: unknown) => bulk(storeValue, values, 'trash'),
    restoreEvents: (storeValue: unknown, values: unknown) => bulk(storeValue, values, 'restore'),
    listEventHistory: (storeValue: unknown, args: ListReferenceEventHistoryQueryVariables) => {
      const storeId = uuid(storeValue, 'x-store-id'),
        snapshot = read(),
        event = findEvent(snapshot, storeId, args.eventId, true),
        { offset, limit } = pagination(args);
      const rows = snapshot.history
        .filter((row) => row.storeId === storeId && row.eventId === event.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return { items: rows.slice(offset, offset + limit), total: rows.length, offset, limit };
    },
  };
}
