import type {
  ReferenceEventDetailsFragment,
  ReferenceSessionDetailsFragment,
} from '../generated/graphql/operations.js';
import type { PrototypeHistoryEntry, PrototypeSnapshot } from './snapshot.js';

type Values = Record<string, string | null>;
export function historyChanges(before: Values, after: Values): PrototypeHistoryEntry['changes'] {
  const bounded = (value: string | null) =>
    value && value.length > 500 ? `${value.slice(0, 500)}…` : value;
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((field) => {
    const previous = before[field] ?? null,
      next = after[field] ?? null;
    return previous === next ? [] : [{ field, before: bounded(previous), after: bounded(next) }];
  });
}
export function eventHistoryValues(row: ReferenceEventDetailsFragment): Values {
  return {
    title: row.title,
    code: row.code,
    status: row.status,
    format: row.format,
    capacity: row.capacity == null ? null : String(row.capacity),
    budget: row.budget ?? null,
    featured: String(row.featured),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    registrationOpensOn: row.registrationOpensOn ?? null,
    registrationClosesOn: row.registrationClosesOn ?? null,
    venue: row.venue ? `${row.venue.name} (${row.venue.id})` : null,
    tags:
      row.tags
        .map((tag) => `${tag.name} (${tag.id})`)
        .sort()
        .join(', ') || null,
    meetingUrl: row.meetingUrl ?? null,
    summary: row.summary ?? null,
    descriptionHtml: row.descriptionHtml ?? null,
  };
}
export function sessionHistoryValues(row: ReferenceSessionDetailsFragment): Values {
  return {
    title: row.title,
    summary: row.summary ?? null,
    room: row.room ?? null,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    speakers:
      row.speakers
        .map((speaker) => `${speaker.name} (${speaker.id})`)
        .sort()
        .join(', ') || null,
  };
}
export function recordHistory(
  snapshot: PrototypeSnapshot,
  storeId: string,
  eventId: string,
  operation: PrototypeHistoryEntry['operation'],
  changes: PrototypeHistoryEntry['changes'],
  subject: string | null = null,
) {
  snapshot.history.push({
    id: crypto.randomUUID(),
    storeId,
    eventId,
    operation,
    subject,
    actor: 'Anonymous',
    changes,
    createdAt: new Date().toISOString(),
  });
}
