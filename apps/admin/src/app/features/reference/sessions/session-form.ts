import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type {
  AdminEventDetailsFragment,
  AdminSessionDetailsFragment,
  CreateReferenceSessionInput,
} from '../../../../generated/graphql/operations';
import type { messages } from '../../../i18n/messages';
import { eventTime, eventInputInstant } from '../events/event-time';
export function sessionDraft(event: AdminEventDetailsFragment, row?: AdminSessionDetailsFragment) {
  return {
    title: row?.title ?? '',
    summary: row?.summary ?? '',
    room: row?.room ?? '',
    startsAt: eventTime(row?.startsAt ?? event.startsAt).format('YYYY-MM-DDTHH:mm'),
    endsAt: row ? eventTime(row.endsAt).format('YYYY-MM-DDTHH:mm') : '',
    speakerIds: [...(row?.speakerIds ?? [])],
  };
}
export type SessionDraft = ReturnType<typeof sessionDraft>;
export const sessionFields = [
  'title',
  'summary',
  'room',
  'startsAt',
  'endsAt',
  'speakerIds',
] as const;
export type SessionField = (typeof sessionFields)[number];
export type SessionErrors = Partial<Record<SessionField, string>>;
export function validateSessionDraft(
  values: SessionDraft,
  event: AdminEventDetailsFragment,
  text: typeof messages.en,
  original?: AdminSessionDetailsFragment,
): SessionErrors {
  const errors: SessionErrors = {};
  for (const [field, max, required] of [
    ['title', 200, true],
    ['summary', 2000, false],
    ['room', 120, false],
  ] as const) {
    const value = values[field].trim();
    if (values[field].includes('\0')) errors[field] = text.unsupportedCharacters;
    else if (required && !value) errors[field] = text.eventRequired;
    else if (Array.from(value).length > max)
      errors[field] = text.maxCharacters.replace('{max}', String(max));
  }
  for (const field of ['startsAt', 'endsAt'] as const) {
    try {
      const time = Date.parse(
        eventInputInstant(
          values[field],
          original?.[field] ?? (field === 'startsAt' ? event.startsAt : undefined),
        ),
      );
      if (time < Date.parse(event.startsAt) || time > Date.parse(event.endsAt))
        errors[field] = text.sessionWithinEvent;
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
    Date.parse(eventInputInstant(values.endsAt, original?.endsAt)) <=
      Date.parse(eventInputInstant(values.startsAt, original?.startsAt ?? event.startsAt))
  )
    errors.endsAt = text.eventEndError;
  if (
    values.speakerIds.length > 100 ||
    new Set(values.speakerIds).size !== values.speakerIds.length ||
    values.speakerIds.some(
      (id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    )
  )
    errors.speakerIds = text.sessionSpeakersLimit;
  return errors;
}
export function sessionInput(
  values: SessionDraft,
  event: AdminEventDetailsFragment,
  original?: AdminSessionDetailsFragment,
): CreateReferenceSessionInput {
  return {
    title: values.title.trim(),
    summary: values.summary.trim() || null,
    room: values.room.trim() || null,
    startsAt: eventInputInstant(values.startsAt, original?.startsAt ?? event.startsAt),
    endsAt: eventInputInstant(values.endsAt, original?.endsAt),
    speakerIds: [...values.speakerIds],
  };
}
export function sessionFieldErrors(error: unknown): SessionErrors {
  const errors: SessionErrors = {};
  if (!CombinedGraphQLErrors.is(error)) return errors;
  for (const failure of error.errors) {
    const fields: unknown = failure.extensions?.['fieldErrors'];
    if (!Array.isArray(fields)) continue;
    for (const candidate of fields) {
      const field: unknown = candidate;
      if (
        typeof field !== 'object' ||
        field === null ||
        !('path' in field) ||
        !('message' in field) ||
        typeof field.message !== 'string'
      )
        continue;
      const name = sessionFields.find((name) => name === field.path);
      if (name) errors[name] = field.message;
    }
  }
  return errors;
}
