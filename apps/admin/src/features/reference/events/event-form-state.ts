import type {
  CreateReferenceEventInput,
  ReferenceEventDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { descriptionBytes, descriptionMaxBytes } from './description-html.js';
import { dayjs, eventInputInstant, eventTime } from './event-time.js';

export function eventDraft(row?: ReferenceEventDetailsFragment) {
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
export type EventField = keyof EventDraft;
function textError(value: string, max: number, required = '') {
  if (!value.trim()) return required;
  if (value.includes('\u0000')) return 'Remove unsupported characters.';
  return Array.from(value.trim()).length > max ? `Use at most ${String(max)} characters.` : '';
}
export function validateEventDraft(values: EventDraft, original?: ReferenceEventDetailsFragment) {
  const errors: Record<EventField, string> = {
    title: textError(values.title, 200, 'Enter a title of up to 200 characters.'),
    code: textError(values.code, 100, 'Enter a code of up to 100 characters.'),
    status: '',
    format: '',
    featured: '',
    tagIds: '',
    capacity:
      values.capacity !== '' &&
      (!Number.isInteger(Number(values.capacity)) ||
        Number(values.capacity) < 1 ||
        Number(values.capacity) > 2147483647)
        ? 'Enter a positive whole number.'
        : '',
    budget:
      values.budget && !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(values.budget)
        ? 'Use 0–9999999999.99, with at most two decimals.'
        : '',
    startsAt: '',
    endsAt: '',
    registrationOpensOn: '',
    registrationClosesOn: '',
    venueId: values.format !== 'ONLINE' && !values.venueId ? 'Choose a venue.' : '',
    meetingUrl: '',
    summary: textError(values.summary, 500),
    descriptionHtml:
      descriptionBytes(values.descriptionHtml) > descriptionMaxBytes
        ? 'Keep the description within 100 KiB.'
        : '',
  };
  for (const field of ['startsAt', 'endsAt'] as const) {
    try {
      eventInputInstant(values[field], original?.[field]);
    } catch (error) {
      errors[field] = error instanceof Error ? error.message : 'Choose a valid date and time.';
    }
  }
  if (
    !errors.startsAt &&
    !errors.endsAt &&
    eventInputInstant(values.endsAt, original?.endsAt) <=
      eventInputInstant(values.startsAt, original?.startsAt)
  )
    errors.endsAt = 'End must be after start.';
  for (const field of ['registrationOpensOn', 'registrationClosesOn'] as const) {
    const value = values[field];
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) || dayjs(value).format('YYYY-MM-DD') !== value)
    )
      errors[field] = 'Choose a valid date.';
  }
  const open = values.registrationOpensOn,
    close = values.registrationClosesOn;
  if (close && !open) errors.registrationOpensOn = 'Provide both registration dates.';
  if (open && !close) errors.registrationClosesOn = 'Provide both registration dates.';
  else if (close && open && close < open)
    errors.registrationClosesOn = 'Close on or after opening.';
  else if (close && values.startsAt && close > values.startsAt.slice(0, 10))
    errors.registrationClosesOn = 'Close by the event start date.';
  if (values.format !== 'IN_PERSON') {
    const url = values.meetingUrl.trim();
    try {
      if (!/^https?:\/\//i.test(url) || Array.from(url).length > 2000)
        throw new Error('Invalid URL');
      new URL(url);
    } catch {
      errors.meetingUrl = url
        ? 'Enter an http or https URL of up to 2000 characters.'
        : 'Enter a meeting URL.';
    }
  }
  return errors;
}
export function eventInput(
  values: EventDraft,
  original?: ReferenceEventDetailsFragment,
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
