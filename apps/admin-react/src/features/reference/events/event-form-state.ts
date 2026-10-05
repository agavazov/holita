import type { TFunction } from 'i18next';
import { fallbackValidation } from '../../../i18n/i18n.js';
import type {
  CreateReferenceEventInput,
  ReferenceEventDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { textError } from '../text-validation.js';
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

export function validateEventDraft(
  values: EventDraft,
  original?: ReferenceEventDetailsFragment,
  t: TFunction<'validation'> = fallbackValidation,
) {
  const errors: Record<EventField, string> = {
    title: textError(values.title, 200, t('reference.title'), t),
    code: textError(values.code, 100, t('reference.code'), t),
    status: '',
    format: '',
    featured: '',
    tagIds: '',
    capacity:
      values.capacity !== '' &&
      (!Number.isInteger(Number(values.capacity)) ||
        Number(values.capacity) < 1 ||
        Number(values.capacity) > 2147483647)
        ? t('reference.positiveInteger')
        : '',
    budget:
      values.budget && !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(values.budget)
        ? t('reference.budget')
        : '',
    startsAt: '',
    endsAt: '',
    registrationOpensOn: '',
    registrationClosesOn: '',
    venueId: values.format !== 'ONLINE' && !values.venueId ? t('reference.venue') : '',
    meetingUrl: '',
    summary: textError(values.summary, 500, '', t),
    descriptionHtml:
      descriptionBytes(values.descriptionHtml) > descriptionMaxBytes
        ? t('reference.description')
        : '',
  };
  for (const field of ['startsAt', 'endsAt'] as const) {
    try {
      eventInputInstant(values[field], original?.[field], t);
    } catch (error) {
      errors[field] = error instanceof Error ? error.message : t('reference.dateTime');
    }
  }
  if (
    !errors.startsAt &&
    !errors.endsAt &&
    eventInputInstant(values.endsAt, original?.endsAt, t) <=
      eventInputInstant(values.startsAt, original?.startsAt, t)
  )
    errors.endsAt = t('reference.endAfterStart');
  for (const field of ['registrationOpensOn', 'registrationClosesOn'] as const) {
    const value = values[field];
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) || dayjs(value).format('YYYY-MM-DD') !== value)
    )
      errors[field] = t('reference.date');
  }
  const open = values.registrationOpensOn,
    close = values.registrationClosesOn;
  if (close && !open) errors.registrationOpensOn = t('reference.registrationDates');
  if (open && !close) errors.registrationClosesOn = t('reference.registrationDates');
  else if (close && open && close < open)
    errors.registrationClosesOn = t('reference.registrationOrder');
  else if (close && values.startsAt && close > values.startsAt.slice(0, 10))
    errors.registrationClosesOn = t('reference.registrationEnd');
  if (values.format !== 'IN_PERSON') {
    const url = values.meetingUrl.trim();
    try {
      if (!/^https?:\/\//i.test(url) || Array.from(url).length > 2000)
        throw new Error('Invalid URL');
      new URL(url);
    } catch {
      errors.meetingUrl = url ? t('reference.url') : t('reference.meetingUrl');
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
