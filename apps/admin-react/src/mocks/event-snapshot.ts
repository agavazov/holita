import isUUID from 'validator/lib/isUUID.js';
import {
  descriptionBytes,
  descriptionMaxBytes,
} from '../features/reference/events/description-html.js';
import type {
  PrototypeEvent,
  PrototypeHistoryEntry,
  PrototypeSession,
  PrototypeSnapshot,
} from './snapshot.js';
import { calendarDate, meetingUrl } from './event-validation.js';
import { distinctRecords, validOptionalText, validRecord, validText } from './validation.js';

function validId(value: unknown): value is string {
  return typeof value === 'string' && isUUID(value) && value.toLowerCase() === value;
}
function validIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every(validId) &&
    new Set(value).size === value.length
  );
}
function validInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function validDate(value: unknown): value is string | null {
  try {
    return (value === null || typeof value === 'string') && calendarDate(value, 'date') === value;
  } catch {
    return false;
  }
}
function validMeeting(value: unknown): value is string | null {
  try {
    return (value === null || typeof value === 'string') && meetingUrl(value) === value;
  } catch {
    return false;
  }
}
export function validEvent(value: unknown): value is PrototypeEvent {
  return (
    validRecord(value) &&
    'title' in value &&
    validText(value.title, 200) &&
    'code' in value &&
    validText(value.code, 100) &&
    'status' in value &&
    (value.status === 'DRAFT' || value.status === 'PUBLISHED' || value.status === 'ARCHIVED') &&
    'format' in value &&
    (value.format === 'IN_PERSON' || value.format === 'ONLINE' || value.format === 'HYBRID') &&
    'capacity' in value &&
    (value.capacity === null ||
      (typeof value.capacity === 'number' &&
        Number.isInteger(value.capacity) &&
        value.capacity >= 1 &&
        value.capacity <= 2147483647)) &&
    'budget' in value &&
    (value.budget === null ||
      (typeof value.budget === 'string' && /^(0|[1-9]\d{0,9})\.\d{2}$/.test(value.budget))) &&
    'featured' in value &&
    typeof value.featured === 'boolean' &&
    'startsAt' in value &&
    validInstant(value.startsAt) &&
    'endsAt' in value &&
    validInstant(value.endsAt) &&
    value.startsAt < value.endsAt &&
    'registrationOpensOn' in value &&
    validDate(value.registrationOpensOn) &&
    'registrationClosesOn' in value &&
    validDate(value.registrationClosesOn) &&
    Boolean(value.registrationOpensOn) === Boolean(value.registrationClosesOn) &&
    (value.registrationOpensOn === null ||
      (value.registrationClosesOn !== null &&
        value.registrationOpensOn <= value.registrationClosesOn &&
        value.registrationClosesOn <=
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Sofia',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(value.startsAt)))) &&
    'venueId' in value &&
    (value.format === 'ONLINE' ? value.venueId === null : validId(value.venueId)) &&
    'meetingUrl' in value &&
    (value.format === 'IN_PERSON'
      ? value.meetingUrl === null
      : value.meetingUrl !== null && validMeeting(value.meetingUrl)) &&
    'tagIds' in value &&
    validIds(value.tagIds) &&
    'summary' in value &&
    validOptionalText(value.summary, 500) &&
    'descriptionHtml' in value &&
    (value.descriptionHtml === null ||
      (typeof value.descriptionHtml === 'string' &&
        !value.descriptionHtml.includes('\0') &&
        descriptionBytes(value.descriptionHtml) <= descriptionMaxBytes)) &&
    'deletedAt' in value &&
    (value.deletedAt === null || validInstant(value.deletedAt))
  );
}
export function validSession(value: unknown): value is PrototypeSession {
  return (
    validRecord(value) &&
    'eventId' in value &&
    validId(value.eventId) &&
    'title' in value &&
    validText(value.title, 200) &&
    'summary' in value &&
    validOptionalText(value.summary, 2000) &&
    'room' in value &&
    validOptionalText(value.room, 120) &&
    'startsAt' in value &&
    validInstant(value.startsAt) &&
    'endsAt' in value &&
    validInstant(value.endsAt) &&
    value.startsAt < value.endsAt &&
    'position' in value &&
    typeof value.position === 'number' &&
    Number.isInteger(value.position) &&
    value.position >= 0 &&
    value.position <= 2147483647 &&
    'speakerIds' in value &&
    validIds(value.speakerIds)
  );
}
export function validHistory(value: unknown): value is PrototypeHistoryEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    validId(value.id) &&
    'storeId' in value &&
    validId(value.storeId) &&
    'eventId' in value &&
    validId(value.eventId) &&
    'operation' in value &&
    typeof value.operation === 'string' &&
    [
      'CREATED',
      'UPDATED',
      'TRASHED',
      'RESTORED',
      'SESSION_CREATED',
      'SESSION_UPDATED',
      'SESSION_DELETED',
      'SESSIONS_REORDERED',
      'MEDIA_ADDED',
      'MEDIA_UPDATED',
      'MEDIA_REMOVED',
      'MEDIA_REORDERED',
      'COVER_CHANGED',
    ].includes(value.operation) &&
    'actor' in value &&
    value.actor === 'Anonymous' &&
    'subject' in value &&
    validOptionalText(value.subject, 255) &&
    'createdAt' in value &&
    validInstant(value.createdAt) &&
    'changes' in value &&
    Array.isArray(value.changes) &&
    value.changes.length <= 20 &&
    value.changes.every(
      (change: unknown) =>
        typeof change === 'object' &&
        change !== null &&
        'field' in change &&
        validText(change.field, 100) &&
        'before' in change &&
        (change.before === null ||
          (typeof change.before === 'string' && change.before.length <= 501)) &&
        'after' in change &&
        (change.after === null || (typeof change.after === 'string' && change.after.length <= 501)),
    )
  );
}
export function validEventRelations(snapshot: PrototypeSnapshot) {
  return (
    distinctRecords(
      snapshot.events,
      snapshot.events.map((row) => JSON.stringify([row.storeId, row.code])),
    ) &&
    distinctRecords(
      snapshot.sessions,
      snapshot.sessions.map((row) => JSON.stringify([row.storeId, row.eventId, row.position])),
    ) &&
    new Set(snapshot.history.map((row) => row.id)).size === snapshot.history.length &&
    snapshot.events.every(
      (event) =>
        (event.venueId === null ||
          snapshot.venues.some(
            (row) => row.storeId === event.storeId && row.id === event.venueId,
          )) &&
        event.tagIds.every((id) =>
          snapshot.tags.some((row) => row.storeId === event.storeId && row.id === id),
        ) &&
        snapshot.sessions.filter((row) => row.eventId === event.id).length <= 100,
    ) &&
    snapshot.sessions.every(
      (session) =>
        snapshot.events.some(
          (event) =>
            event.storeId === session.storeId &&
            event.id === session.eventId &&
            session.startsAt >= event.startsAt &&
            session.endsAt <= event.endsAt,
        ) &&
        session.speakerIds.every((id) =>
          snapshot.speakers.some((row) => row.storeId === session.storeId && row.id === id),
        ),
    ) &&
    snapshot.history.every((entry) =>
      snapshot.events.some(
        (event) => event.storeId === entry.storeId && event.id === entry.eventId,
      ),
    )
  );
}
