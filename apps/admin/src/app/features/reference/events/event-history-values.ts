import type { ReferenceEventHistoryOperation } from '../../../../generated/graphql/operations';
import { messages, type Language } from '../../../i18n/messages';
import { safeDescriptionHtml } from './description-html';
import { eventTime, formatEventTime } from './event-time';

export function historyOperationLabel(
  operation: ReferenceEventHistoryOperation,
  language: Language,
): string {
  const text = messages[language];
  const labels = {
    CREATED: text.eventHistoryCreated,
    UPDATED: text.eventHistoryUpdated,
    TRASHED: text.eventHistoryTrashed,
    RESTORED: text.eventHistoryRestored,
    SESSION_CREATED: text.eventHistorySessionCreated,
    SESSION_UPDATED: text.eventHistorySessionUpdated,
    SESSION_DELETED: text.eventHistorySessionDeleted,
    SESSIONS_REORDERED: text.eventHistorySessionsReordered,
    MEDIA_ADDED: text.eventHistoryMediaAdded,
    MEDIA_UPDATED: text.eventHistoryMediaUpdated,
    MEDIA_REMOVED: text.eventHistoryMediaRemoved,
    MEDIA_REORDERED: text.eventHistoryMediaReordered,
    COVER_CHANGED: text.eventHistoryCoverChanged,
  } satisfies Record<ReferenceEventHistoryOperation, string>;
  return labels[operation];
}
export function historyFieldLabel(field: string, language: Language): string {
  const text = messages[language];
  const labels: Record<string, string | undefined> = {
    title: text.eventTitle,
    code: text.eventCode,
    status: text.status,
    format: text.eventFormat,
    capacity: text.capacity,
    budget: text.eventBudget,
    featured: text.eventFeatured,
    startsAt: text.eventStartsAt,
    endsAt: text.eventEndsAt,
    registrationOpensOn: text.eventRegistrationOpens,
    registrationClosesOn: text.eventRegistrationCloses,
    venue: text.eventVenue,
    tags: text.tags,
    meetingUrl: text.eventMeetingUrl,
    summary: text.eventSummary,
    descriptionHtml: text.eventDescription,
    room: text.eventHistoryRoom,
    speakers: text.eventHistorySpeakers,
    sessionOrder: text.eventHistorySessionOrder,
    galleryOrder: text.eventHistoryGalleryOrder,
    cover: text.eventHistoryCover,
    altText: text.eventHistoryAltText,
  };
  return labels[field] ?? field;
}
export function historyValue(field: string, value: string | null, language: Language): string {
  if (value === null) return '—';
  const text = messages[language];
  if (field === 'descriptionHtml') {
    const doc = new DOMParser().parseFromString(safeDescriptionHtml(value), 'text/html');
    for (const block of doc.body.querySelectorAll('p,h2,h3,li,br')) block.append(' ');
    return doc.body.textContent.replace(/\s+/g, ' ').trim() || '—';
  }
  if (field === 'status') {
    if (value === 'DRAFT') return text.eventDraft;
    if (value === 'PUBLISHED') return text.eventPublished;
    if (value === 'ARCHIVED') return text.eventArchived;
  }
  if (field === 'format') {
    if (value === 'ONLINE') return text.eventOnline;
    if (value === 'IN_PERSON') return text.eventInPerson;
    if (value === 'HYBRID') return text.eventHybrid;
  }
  if (field === 'featured' && (value === 'true' || value === 'false'))
    return value === 'true' ? text.yes : text.no;
  if ((field === 'startsAt' || field === 'endsAt') && eventTime(value).isValid())
    return `${formatEventTime(value, language)} ${eventTime(value).format('Z')}`;
  return value;
}
