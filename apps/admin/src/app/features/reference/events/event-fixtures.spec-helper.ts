import type { AdminEventDetailsFragment } from '../../../../generated/graphql/operations';
export const storeA = '10000000-0000-4000-8000-000000000001';
export const storeB = '10000000-0000-4000-8000-000000000002';
export function eventRecord(storeId = storeA, title = 'Initial event'): AdminEventDetailsFragment {
  return {
    id: '60000000-0000-4000-8000-000000000001',
    storeId,
    title,
    code: 'EVENT-ONE',
    status: 'DRAFT',
    format: 'ONLINE',
    capacity: 180,
    budget: '9999999999.99',
    featured: false,
    startsAt: '2026-10-25T01:30:42.123Z',
    endsAt: '2026-10-25T03:30:45.456Z',
    registrationOpensOn: null,
    registrationClosesOn: null,
    venueId: null,
    venue: null,
    meetingUrl: 'https://example.com/meet',
    tagIds: [],
    tags: [],
    summary: null,
    descriptionHtml: '<p>Saved description</p>',
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}
export function eventDetail(row = eventRecord()) {
  return { data: { referenceEvent: { ...row, __typename: 'ReferenceEvent' } } };
}
export function eventPage(row = eventRecord()) {
  return {
    data: {
      referenceEvents: {
        __typename: 'ReferenceEventPage',
        items: [{ ...row, __typename: 'ReferenceEvent' }],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}
