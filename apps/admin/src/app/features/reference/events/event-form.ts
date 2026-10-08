import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type {
  AdminEventDetailsFragment,
  CreateReferenceEventInput,
  ReferenceEventFormat,
  ReferenceEventStatus,
  UpdateReferenceEventInput,
} from '../../../../generated/graphql/operations';
import type { messages } from '../../../i18n/messages';
import { descriptionBytes, descriptionMaxBytes } from './description-html';
import { eventInputInstant, eventTime, validCalendarDate } from './event-time';
export const eventStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] satisfies ReferenceEventStatus[];
export const eventFormats = ['IN_PERSON', 'ONLINE', 'HYBRID'] satisfies ReferenceEventFormat[];
export function eventDraft(row?: AdminEventDetailsFragment) {
  return {
    title: row?.title ?? '',
    code: row?.code ?? '',
    status: row?.status ?? 'DRAFT',
    format: row?.format ?? 'IN_PERSON',
    capacity: row?.capacity?.toString() ?? '',
    budget: row?.budget ?? '',
    featured: row?.featured ?? false,
    startsAt: row ? eventTime(row.startsAt).format('YYYY-MM-DDTHH:mm') : '',
    endsAt: row ? eventTime(row.endsAt).format('YYYY-MM-DDTHH:mm') : '',
    registrationOpensOn: row?.registrationOpensOn ?? '',
    registrationClosesOn: row?.registrationClosesOn ?? '',
    venueId: row?.venueId ?? '',
    meetingUrl: row?.meetingUrl ?? '',
    tagIds: row?.tagIds ?? [],
    summary: row?.summary ?? '',
    descriptionHtml: row?.descriptionHtml ?? '',
  };
}
export type EventDraft = ReturnType<typeof eventDraft>;
export const eventFields = [
  'title',
  'code',
  'status',
  'format',
  'capacity',
  'budget',
  'featured',
  'startsAt',
  'endsAt',
  'registrationOpensOn',
  'registrationClosesOn',
  'venueId',
  'meetingUrl',
  'tagIds',
  'summary',
  'descriptionHtml',
] as const;
export type EventField = (typeof eventFields)[number];
export type EventErrors = Partial<Record<EventField, string>>;
export function validateEventDraft(
  values: EventDraft,
  text: typeof messages.en,
  original?: AdminEventDetailsFragment,
): EventErrors {
  const errors: EventErrors = {};
  for (const [field, max, required] of [
    ['title', 200, true],
    ['code', 100, true],
    ['summary', 500, false],
  ] as const) {
    const value = values[field].trim();
    if (values[field].includes('\0')) errors[field] = text.unsupportedCharacters;
    else if (required && !value) errors[field] = text.eventRequired;
    else if (Array.from(value).length > max)
      errors[field] = text.maxCharacters.replace('{max}', String(max));
  }
  if (!eventStatuses.includes(values.status)) errors.status = text.eventRequired;
  if (!eventFormats.includes(values.format)) errors.format = text.eventRequired;
  if (typeof values.featured !== 'boolean') errors.featured = text.eventRequired;
  if (
    values.capacity &&
    (!/^\d+$/.test(values.capacity) ||
      Number(values.capacity) < 1 ||
      Number(values.capacity) > 2147483647)
  )
    errors.capacity = text.eventCapacityError;
  if (values.budget && !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(values.budget))
    errors.budget = text.eventBudgetError;
  for (const field of ['startsAt', 'endsAt'] as const) {
    try {
      eventInputInstant(values[field], original?.[field]);
    } catch (error: unknown) {
      errors[field] =
        error instanceof Error && error.message === 'missingTime'
          ? text.eventMissingTime
          : text.eventDateTimeError;
    }
  }
  if (
    !errors.startsAt &&
    !errors.endsAt &&
    eventInputInstant(values.endsAt, original?.endsAt) <=
      eventInputInstant(values.startsAt, original?.startsAt)
  )
    errors.endsAt = text.eventEndError;
  for (const field of ['registrationOpensOn', 'registrationClosesOn'] as const) {
    if (values[field] && !validCalendarDate(values[field])) errors[field] = text.eventDateError;
  }
  const open = values.registrationOpensOn,
    close = values.registrationClosesOn;
  if (open && !close) errors.registrationClosesOn = text.eventRegistrationPair;
  if (close && !open) errors.registrationOpensOn = text.eventRegistrationPair;
  if (open && close && close < open) errors.registrationClosesOn = text.eventRegistrationOrder;
  if (close && values.startsAt && close > values.startsAt.slice(0, 10))
    errors.registrationClosesOn = text.eventRegistrationEnd;
  if (
    values.format !== 'ONLINE' &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values.venueId)
  )
    errors.venueId = text.eventVenueRequired;
  if (values.format !== 'IN_PERSON') {
    const value = values.meetingUrl.trim();
    try {
      if (!/^https?:\/\//i.test(value) || Array.from(value).length > 2000 || value.includes('\0'))
        throw new Error('url');
      new URL(value);
    } catch {
      errors.meetingUrl = text.eventMeetingError;
    }
  }
  if (
    values.tagIds.length > 100 ||
    values.tagIds.some(
      (id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    )
  )
    errors.tagIds = text.eventRelationsError;
  if (values.descriptionHtml.includes('\0')) errors.descriptionHtml = text.unsupportedCharacters;
  else if (descriptionBytes(values.descriptionHtml) > descriptionMaxBytes)
    errors.descriptionHtml = text.eventDescriptionLimit;
  return errors;
}
export function eventInput(
  values: EventDraft,
  original?: AdminEventDetailsFragment,
): CreateReferenceEventInput {
  return {
    title: values.title.trim(),
    code: values.code.trim(),
    status: values.status,
    format: values.format,
    capacity: values.capacity === '' ? null : Number(values.capacity),
    budget: values.budget || null,
    featured: values.featured,
    startsAt: eventInputInstant(values.startsAt, original?.startsAt),
    endsAt: eventInputInstant(values.endsAt, original?.endsAt),
    registrationOpensOn: values.registrationOpensOn || null,
    registrationClosesOn: values.registrationClosesOn || null,
    venueId: values.format === 'ONLINE' ? null : values.venueId || null,
    meetingUrl: values.format === 'IN_PERSON' ? null : values.meetingUrl.trim() || null,
    tagIds: values.tagIds,
    summary: values.summary.trim() || null,
    descriptionHtml: values.descriptionHtml || null,
  };
}
export function eventUpdateInput(
  values: EventDraft,
  original: AdminEventDetailsFragment,
): UpdateReferenceEventInput {
  const { code: immutableCode, ...input } = eventInput(values, original);
  if (immutableCode !== original.code) throw new Error('Event code is immutable.');
  return input;
}
export function eventFieldErrors(error: unknown): EventErrors {
  const result: EventErrors = {};
  if (!CombinedGraphQLErrors.is(error)) return result;
  for (const failure of error.errors) {
    const fields: unknown = failure.extensions?.['fieldErrors'];
    if (!Array.isArray(fields)) continue;
    for (const candidate of fields.slice(0, 30)) {
      const field: unknown = candidate;
      if (
        typeof field !== 'object' ||
        field === null ||
        !('path' in field) ||
        !('message' in field) ||
        typeof field.message !== 'string' ||
        field.message.length > 300
      )
        continue;
      const path = eventFields.find((name) => name === field.path);
      if (path && !result[path]) result[path] = field.message;
    }
  }
  return result;
}
