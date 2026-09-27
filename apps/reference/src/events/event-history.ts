import type { ReferenceEventChange } from '../generated/graphql/types.js';
import type { EventRow } from './events.repository.js';
import type { SessionRow } from '../sessions/sessions.repository.js';

type Values = Record<string, string | null>;
const bounded = (value: string | null) =>
  value && value.length > 500 ? `${value.slice(0, 500)}…` : value;

export function historyChanges(before: Values, after: Values): ReferenceEventChange[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((field) => {
    const previous = before[field] ?? null,
      next = after[field] ?? null;
    return previous === next ? [] : [{ field, before: bounded(previous), after: bounded(next) }];
  });
}

export function eventHistoryValues(row: EventRow): Values {
  return {
    title: row.title,
    code: row.code,
    status: row.status,
    format: row.format,
    capacity: row.capacity === null ? null : String(row.capacity),
    budget: row.budget?.toFixed(2) ?? null,
    featured: String(row.featured),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    registrationOpensOn: row.registrationOpensOn?.toISOString().slice(0, 10) ?? null,
    registrationClosesOn: row.registrationClosesOn?.toISOString().slice(0, 10) ?? null,
    venue: row.venue ? `${row.venue.name} (${row.venue.id})` : null,
    tags:
      row.tags
        .map(({ tag }) => `${tag.name} (${tag.id})`)
        .sort()
        .join(', ') || null,
    meetingUrl: row.meetingUrl,
    summary: row.summary,
    descriptionHtml: row.descriptionHtml,
  };
}

export function sessionHistoryValues(row: SessionRow): Values {
  return {
    title: row.title,
    summary: row.summary,
    room: row.room,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    speakers:
      row.speakers
        .map(({ speaker }) => `${speaker.name} (${speaker.id})`)
        .sort()
        .join(', ') || null,
  };
}
