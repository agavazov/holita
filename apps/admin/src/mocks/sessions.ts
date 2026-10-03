import { DataError } from '../data/data-error.js';
import type {
  CreateReferenceSessionInput,
  UpdateReferenceSessionInput,
  ReferenceSessionDetailsFragment,
} from '../generated/graphql/operations.js';
import type { PrototypePersistence, PrototypeSession, PrototypeSnapshot } from './snapshot.js';
import { findEvent, writableEvent } from './events.js';
import { historyChanges, recordHistory, sessionHistoryValues } from './event-history.js';
import { ids, instant, invalid, optionalText, text, uuid } from './validation.js';

function sessionResult(
  snapshot: PrototypeSnapshot,
  row: PrototypeSession,
): ReferenceSessionDetailsFragment {
  const speakers = snapshot.speakers
    .filter((speaker) => speaker.storeId === row.storeId && row.speakerIds.includes(speaker.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { ...row, speakerIds: speakers.map((speaker) => speaker.id), speakers };
}
function ordered(snapshot: PrototypeSnapshot, storeId: string, eventId: string) {
  return snapshot.sessions
    .filter((row) => row.storeId === storeId && row.eventId === eventId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
function fields(
  input: CreateReferenceSessionInput | UpdateReferenceSessionInput,
  event: { startsAt: string; endsAt: string },
) {
  const startsAt = instant(input.startsAt, 'startsAt'),
    endsAt = instant(input.endsAt, 'endsAt');
  if (endsAt <= startsAt) invalid('endsAt', 'End must be after start.');
  if (startsAt < event.startsAt) invalid('startsAt', 'The session must start within the event.');
  if (endsAt > event.endsAt) invalid('endsAt', 'The session must end within the event.');
  return {
    title: text(input.title, 'title', 200),
    summary: optionalText(input.summary, 'summary', 2000),
    room: optionalText(input.room, 'room', 120),
    startsAt,
    endsAt,
  };
}
function speakers(
  snapshot: PrototypeSnapshot,
  storeId: string,
  value: unknown,
  previous?: PrototypeSession,
) {
  const selected = ids(value, 'speakerIds'),
    added = selected.filter((id) => !previous?.speakerIds.includes(id));
  if (
    added.some(
      (id) =>
        !snapshot.speakers.some((row) => row.storeId === storeId && row.id === id && row.active),
    )
  )
    invalid('speakerIds', 'Choose active speakers in this store.');
  return selected;
}
function findSession(snapshot: PrototypeSnapshot, storeId: string, eventId: string, id: unknown) {
  const recordId = uuid(id, 'id'),
    row = snapshot.sessions.find(
      (session) =>
        session.storeId === storeId && session.eventId === eventId && session.id === recordId,
    );
  if (!row) throw new DataError('Session not found');
  return row;
}
export function createSessionState({ read, write }: PrototypePersistence) {
  return {
    listSessions: (storeValue: unknown, parentId: unknown) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = findEvent(snapshot, storeId, uuid(parentId, 'eventId'));
      return ordered(snapshot, storeId, event.id).map((row) => sessionResult(snapshot, row));
    },
    getSession: (storeValue: unknown, parentId: unknown, id: unknown) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        eventId = uuid(parentId, 'eventId');
      if (
        !snapshot.events.some(
          (event) => event.storeId === storeId && event.id === eventId && !event.deletedAt,
        )
      )
        throw new DataError('Session not found');
      return sessionResult(snapshot, findSession(snapshot, storeId, eventId, id));
    },
    createSession: (storeValue: unknown, parentId: unknown, input: CreateReferenceSessionInput) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, uuid(parentId, 'eventId')),
        rows = ordered(snapshot, storeId, event.id),
        now = new Date().toISOString();
      if (rows.length >= 100) throw new DataError('An event can have at most 100 sessions.');
      const row: PrototypeSession = {
        ...fields(input, event),
        id: crypto.randomUUID(),
        storeId,
        eventId: event.id,
        position: Math.max(-1, ...rows.map((item) => item.position)) + 1,
        speakerIds: speakers(
          snapshot,
          storeId,
          input.speakerIds === undefined ? [] : input.speakerIds,
        ),
        createdAt: now,
        updatedAt: now,
      };
      snapshot.sessions.push(row);
      const result = sessionResult(snapshot, row);
      recordHistory(
        snapshot,
        storeId,
        event.id,
        'SESSION_CREATED',
        historyChanges({}, sessionHistoryValues(result)),
        row.title,
      );
      write(snapshot);
      return result;
    },
    updateSession: (
      storeValue: unknown,
      parentId: unknown,
      id: unknown,
      input: UpdateReferenceSessionInput,
    ) => {
      if (!Object.keys(input).length)
        throw new DataError('Provide at least one session field to update');
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, uuid(parentId, 'eventId')),
        previous = findSession(snapshot, storeId, event.id, id);
      const row: PrototypeSession = {
        ...previous,
        ...fields({ ...previous, ...input }, event),
        speakerIds:
          input.speakerIds === undefined
            ? previous.speakerIds
            : speakers(snapshot, storeId, input.speakerIds, previous),
        updatedAt: new Date().toISOString(),
      };
      const result = sessionResult(snapshot, row),
        changes = historyChanges(
          sessionHistoryValues(sessionResult(snapshot, previous)),
          sessionHistoryValues(result),
        );
      snapshot.sessions = snapshot.sessions.map((item) => (item.id === row.id ? row : item));
      if (changes.length)
        recordHistory(snapshot, storeId, event.id, 'SESSION_UPDATED', changes, row.title);
      write(snapshot);
      return result;
    },
    deleteSession: (storeValue: unknown, parentId: unknown, id: unknown) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, uuid(parentId, 'eventId')),
        row = findSession(snapshot, storeId, event.id, id);
      const result = sessionResult(snapshot, row);
      snapshot.sessions = snapshot.sessions.filter((item) => item.id !== row.id);
      recordHistory(snapshot, storeId, event.id, 'SESSION_DELETED', [], row.title);
      write(snapshot);
      return result;
    },
    reorderSessions: (storeValue: unknown, parentId: unknown, value: unknown) => {
      const snapshot = read(),
        storeId = uuid(storeValue, 'x-store-id'),
        event = writableEvent(snapshot, storeId, uuid(parentId, 'eventId')),
        selected = ids(value, 'ids'),
        rows = ordered(snapshot, storeId, event.id);
      if (rows.length !== selected.length || rows.some((row) => !selected.includes(row.id)))
        throw new DataError(
          'The session list changed. Cancel the draft to reload it, then arrange it again.',
        );
      const updated = selected.map((id, position) => ({
        ...findSession(snapshot, storeId, event.id, id),
        position,
        updatedAt: new Date().toISOString(),
      }));
      const order = (items: PrototypeSession[]) =>
        items.map((row) => `${row.title} (${row.id})`).join(', ');
      const changes = historyChanges(
        { sessionOrder: order(rows) },
        { sessionOrder: order(updated) },
      );
      snapshot.sessions = [
        ...snapshot.sessions.filter((row) => row.storeId !== storeId || row.eventId !== event.id),
        ...updated,
      ];
      if (changes.length) recordHistory(snapshot, storeId, event.id, 'SESSIONS_REORDERED', changes);
      write(snapshot);
      return updated.map((row) => sessionResult(snapshot, row));
    },
  };
}
