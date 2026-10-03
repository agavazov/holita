import type {
  CreateReferenceEventInput,
  ReferenceEventStatus,
  ReferenceEventFormat,
  UpdateReferenceEventInput,
} from '../generated/graphql/operations.js';
import {
  descriptionBytes,
  descriptionMaxBytes,
  isDescriptionLink,
  safeDescriptionHtml,
} from '../features/reference/events/description-html.js';
import {
  boolean,
  capacity,
  ids,
  instant,
  invalid,
  optionalText,
  text,
  uuid,
} from './validation.js';

export function eventStatus(value: unknown): ReferenceEventStatus {
  if (value !== 'DRAFT' && value !== 'PUBLISHED' && value !== 'ARCHIVED')
    invalid('status', 'Choose a valid status.');
  return value;
}
export function eventFormat(value: unknown): ReferenceEventFormat {
  if (value !== 'IN_PERSON' && value !== 'ONLINE' && value !== 'HYBRID')
    invalid('format', 'Choose an event format.');
  return value;
}
export function calendarDate(value: unknown, path: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    invalid(path, 'Use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    invalid(path, 'Enter a valid calendar date.');
  return value;
}
export function eventBudget(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value))
    invalid('budget', 'Enter an amount from 0 to 9999999999.99 with at most two decimals.');
  const [whole = '0', fraction = ''] = value.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}
export function meetingUrl(value: unknown): string | null {
  const raw = optionalText(value, 'meetingUrl', 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return raw;
  } catch {
    // Return the same field error as the owning service.
  }
  invalid('meetingUrl', 'Enter an http or https meeting URL.');
}
export function eventDescription(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') invalid('descriptionHtml', 'Enter a text description.');
  if (value.includes('\0')) invalid('descriptionHtml', 'Remove unsupported NUL characters.');
  if (descriptionBytes(value) > descriptionMaxBytes)
    invalid('descriptionHtml', 'Keep the description within 100 KiB.');
  const template = document.createElement('template');
  template.innerHTML = safeDescriptionHtml(value);
  for (const element of template.content.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (!(
        (element.tagName === 'A' &&
          attribute.name === 'href' &&
          isDescriptionLink(attribute.value)) ||
        (element.tagName === 'OL' && attribute.name === 'start')
      ))
        element.removeAttribute(attribute.name);
    }
    if (element.tagName === 'B' || element.tagName === 'I') {
      const replacement = document.createElement(element.tagName === 'B' ? 'strong' : 'em');
      replacement.append(...Array.from(element.childNodes));
      element.replaceWith(replacement);
    }
  }
  const clean = template.innerHTML.trim();
  if (descriptionBytes(clean) > descriptionMaxBytes)
    invalid('descriptionHtml', 'Keep the formatted description within 100 KiB.');
  return template.content.textContent.replaceAll('\u00a0', ' ').trim() ? clean : null;
}
export function eventFields(
  input: CreateReferenceEventInput | (UpdateReferenceEventInput & { code: string }),
) {
  const format = eventFormat(input.format);
  const startsAt = instant(input.startsAt, 'startsAt'),
    endsAt = instant(input.endsAt, 'endsAt');
  if (endsAt <= startsAt) invalid('endsAt', 'End must be after start.');
  const registrationOpensOn = calendarDate(input.registrationOpensOn, 'registrationOpensOn');
  const registrationClosesOn = calendarDate(input.registrationClosesOn, 'registrationClosesOn');
  const startDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(startsAt));
  if (Boolean(registrationOpensOn) !== Boolean(registrationClosesOn))
    invalid(
      registrationOpensOn ? 'registrationClosesOn' : 'registrationOpensOn',
      'Provide both registration dates.',
    );
  if (registrationOpensOn && registrationClosesOn && registrationOpensOn > registrationClosesOn)
    invalid('registrationClosesOn', 'Registration must close on or after opening.');
  if (registrationClosesOn && registrationClosesOn > startDate)
    invalid(
      'registrationClosesOn',
      'Registration must close by the event start date in Europe/Sofia.',
    );
  const venueId = format === 'ONLINE' ? null : uuid(input.venueId, 'venueId');
  const url = format === 'IN_PERSON' ? null : meetingUrl(input.meetingUrl);
  if (format !== 'IN_PERSON' && !url) invalid('meetingUrl', 'Enter a meeting URL for this format.');
  return {
    title: text(input.title, 'title', 200),
    code: text(input.code, 'code', 100),
    status: eventStatus(input.status === undefined ? 'DRAFT' : input.status),
    format,
    capacity: capacity(input.capacity),
    budget: eventBudget(input.budget),
    featured: boolean(input.featured === undefined ? false : input.featured, 'featured'),
    startsAt,
    endsAt,
    registrationOpensOn,
    registrationClosesOn,
    venueId,
    meetingUrl: url,
    tagIds: ids(input.tagIds === undefined ? [] : input.tagIds, 'tagIds'),
    summary: optionalText(input.summary, 'summary', 500),
    descriptionHtml: eventDescription(input.descriptionHtml),
  };
}
