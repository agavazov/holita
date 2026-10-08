import type { AdminSessionDetailsFragment } from '../../../../generated/graphql/operations';
import { eventRecord } from '../events/event-fixtures.spec-helper';
export function sessionRecord(
  title = 'Keynote',
  id = '70000000-0000-4000-8000-000000000001',
): AdminSessionDetailsFragment {
  const event = eventRecord();
  return {
    id,
    storeId: event.storeId,
    eventId: event.id,
    title,
    summary: 'Plain summary',
    room: 'Main hall',
    startsAt: '2026-10-25T01:45:42.123Z',
    endsAt: '2026-10-25T02:00:45.456Z',
    position: 0,
    speakerIds: [],
    speakers: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}
export function sessionsResponse(rows = [sessionRecord()]) {
  return {
    data: { referenceSessions: rows.map((row) => ({ ...row, __typename: 'ReferenceSession' })) },
  };
}
