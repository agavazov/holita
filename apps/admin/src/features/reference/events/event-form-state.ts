import type {
  CreateReferenceEventInput,
  ReferenceEventDetailsFragment,
} from '../../../generated/graphql/operations.js';
import { dictionaries, type TranslationKey } from '../../../localization/dictionaries.js';
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

type Translate = (key: TranslationKey) => string;
const english: Translate = (key) => dictionaries.en[key];

export function validateEventDraft(
  values: EventDraft,
  original?: ReferenceEventDetailsFragment,
  t: Translate = english,
) {
  const errors: Record<EventField, string> = {
    title: textError(values.title, 200, t, t('reference.events.validationTitle')),
    code: textError(values.code, 100, t, t('reference.events.validationCode')),
    status: '',
    format: '',
    featured: '',
    tagIds: '',
    capacity:
      values.capacity !== '' &&
      (!Number.isInteger(Number(values.capacity)) ||
        Number(values.capacity) < 1 ||
        Number(values.capacity) > 2147483647)
        ? t('reference.events.validationCapacity')
        : '',
    budget:
      values.budget && !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(values.budget)
        ? t('reference.events.validationBudget')
        : '',
    startsAt: '',
    endsAt: '',
    registrationOpensOn: '',
    registrationClosesOn: '',
    venueId: values.format !== 'ONLINE' && !values.venueId ? t('reference.events.validationVenue') : '',
    meetingUrl: '',
    summary: textError(values.summary, 500, t),
    descriptionHtml:
      descriptionBytes(values.descriptionHtml) > descriptionMaxBytes
        ? t('reference.events.validationDescription')
        : '',
  };
  for (const field of ['startsAt', 'endsAt'] as const) {
    try {
      eventInputInstant(values[field], original?.[field]);
    } catch {
      errors[field] = t('reference.events.validationDateTime');
    }
  }
  if (
    !errors.startsAt &&
    !errors.endsAt &&
    eventInputInstant(values.endsAt, original?.endsAt) <=
      eventInputInstant(values.startsAt, original?.startsAt)
  )
    errors.endsAt = t('reference.events.validationEndAfterStart');
  for (const field of ['registrationOpensOn', 'registrationClosesOn'] as const) {
    const value = values[field];
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) || dayjs(value).format('YYYY-MM-DD') !== value)
    )
      errors[field] = t('reference.events.validationDate');
  }
  const open = values.registrationOpensOn,
    close = values.registrationClosesOn;
  if (close && !open) errors.registrationOpensOn = t('reference.events.validationRegistrationBoth');
  if (open && !close) errors.registrationClosesOn = t('reference.events.validationRegistrationBoth');
  else if (close && open && close < open)
    errors.registrationClosesOn = t('reference.events.validationRegistrationOrder');
  else if (close && values.startsAt && close > values.startsAt.slice(0, 10))
    errors.registrationClosesOn = t('reference.events.validationRegistrationStart');
  if (values.format !== 'IN_PERSON') {
    const url = values.meetingUrl.trim();
    try {
      if (!/^https?:\/\//i.test(url) || Array.from(url).length > 2000)
        throw new Error('Invalid URL');
      new URL(url);
    } catch {
      errors.meetingUrl = url
        ? t('reference.events.validationMeetingUrl')
        : t('reference.events.validationMeetingRequired');
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
