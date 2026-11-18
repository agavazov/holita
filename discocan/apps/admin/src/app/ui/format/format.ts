import type { AdminFleetSettingsFragment } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { interpolate, uiMessages } from '../i18n/messages';

/** Display for an absent value; `0` is always a number. */
export const emptyValue = '—';

export type FleetDateFormat = AdminFleetSettingsFragment['dateFormat'];
export const defaultDateFormat: FleetDateFormat = 'YYYY_MM_DD';
export const supportedDateFormats: readonly FleetDateFormat[] = [
  'YYYY_MM_DD',
  'DD_MM_YYYY',
  'DD_DOT_MM_DOT_YYYY',
];

export const dateFormatLabels: Readonly<Record<FleetDateFormat, string>> = {
  YYYY_MM_DD: 'YYYY-MM-DD',
  DD_MM_YYYY: 'DD-MM-YYYY',
  DD_DOT_MM_DOT_YYYY: 'DD.MM.YYYY',
};

/** PrimeNG uses yy for a four-digit year; all picker callers share this mapping. */
export function datePickerFormat(dateFormat: FleetDateFormat = defaultDateFormat): string {
  return { YYYY_MM_DD: 'yy-mm-dd', DD_MM_YYYY: 'dd-mm-yy', DD_DOT_MM_DOT_YYYY: 'dd.mm.yy' }[
    dateFormat
  ];
}

function numericDate(
  year: string,
  month: string,
  day: string,
  dateFormat: FleetDateFormat,
): string {
  switch (dateFormat) {
    case 'YYYY_MM_DD':
      return `${year}-${month}-${day}`;
    case 'DD_MM_YYYY':
      return `${day}-${month}-${year}`;
    case 'DD_DOT_MM_DOT_YYYY':
      return `${day}.${month}.${year}`;
  }
}

const locales: Readonly<Record<Language, string>> = { bg: 'bg-BG', en: 'en-GB' };

export function localeOf(language: Language): string {
  return locales[language];
}

/** Grouped number; `significantDigits` takes precedence over `fraction`; absent values → "—". */
export function formatNumber(
  value: number | null | undefined,
  language: Language,
  options: { readonly fraction?: number; readonly significantDigits?: number } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return emptyValue;
  }
  return new Intl.NumberFormat(localeOf(language), {
    ...(options.significantDigits === undefined
      ? { maximumFractionDigits: options.fraction ?? 0, minimumFractionDigits: 0 }
      : { maximumSignificantDigits: options.significantDigits }),
    useGrouping: 'always',
  }).format(value);
}

/** EUR from integer cents; `null` → "—", `0` → "0,00 €". */
export function formatMoneyCents(cents: number | null | undefined, language: Language): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return emptyValue;
  }
  return new Intl.NumberFormat(localeOf(language), {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  }).format(cents / 100);
}

function parts(date: Date, language: Language, options: Intl.DateTimeFormatOptions) {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of new Intl.DateTimeFormat(localeOf(language), options).formatToParts(date)) {
    values[part.type] = part.value;
  }
  return values;
}

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Chosen numeric date order and 24-hour Branch wall time, optionally with seconds. */
export function formatDateTime(
  iso: string | null | undefined,
  language: Language,
  timeZone: string,
  seconds = false,
  dateFormat: FleetDateFormat = defaultDateFormat,
): string {
  const date = validDate(iso);
  if (!date) {
    return emptyValue;
  }
  const value = parts(date, language, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    hourCycle: 'h23',
  });
  const { day = '', month = '', year = '', hour = '', minute = '' } = value;
  const time = `${hour}:${minute}${seconds ? `:${value.second ?? ''}` : ''}`;
  return `${numericDate(year, month, day, dateFormat)} ${time}`;
}

/** Hours and minutes in the Branch time zone; absent values show "—". */
export function formatTime(
  iso: string | null | undefined,
  language: Language,
  timeZone: string,
): string {
  const date = validDate(iso);
  if (!date) {
    return emptyValue;
  }
  const { hour = '', minute = '' } = parts(date, language, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${hour}:${minute}`;
}

/** A calendar date (`YYYY-MM-DD`) without time-zone conversion. */
export function formatDateOnly(
  text: string | null | undefined,
  _language: Language,
  dateFormat: FleetDateFormat = defaultDateFormat,
): string {
  const match = text ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;
  if (!match) {
    return emptyValue;
  }
  const [, year = '', month = '', day = ''] = match;
  return numericDate(year, month, day, dateFormat);
}

/** Exact UTC instant for a title/tooltip, normalized with seconds and milliseconds. */
export function formatUtcInstant(iso: string | null | undefined): string {
  return validDate(iso)?.toISOString() ?? emptyValue;
}

/** A table/read-value label and its exact UTC title must describe the same instant. */
export function formatDateTimeCell(
  iso: string | null | undefined,
  language: Language,
  timeZone: string,
  seconds = false,
  dateFormat: FleetDateFormat = defaultDateFormat,
): { readonly text: string; readonly title: string } {
  return {
    text: formatDateTime(iso, language, timeZone, seconds, dateFormat),
    title: formatUtcInstant(iso),
  };
}

/** Calendar-date range; endpoints retain their date-only meaning in every Branch zone. */
export function formatDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
  language: Language,
  dateFormat: FleetDateFormat = defaultDateFormat,
): string {
  if (!from && !to) {
    return emptyValue;
  }
  return `${formatDateOnly(from, language, dateFormat)} – ${formatDateOnly(to, language, dateFormat)}`;
}

/** Instant range in one Branch time zone, using the same numeric order at both endpoints. */
export function formatDateTimeRange(
  from: string | null | undefined,
  to: string | null | undefined,
  language: Language,
  timeZone: string,
  seconds = false,
  dateFormat: FleetDateFormat = defaultDateFormat,
): string {
  if (!from && !to) {
    return emptyValue;
  }
  return `${formatDateTime(from, language, timeZone, seconds, dateFormat)} – ${formatDateTime(to, language, timeZone, seconds, dateFormat)}`;
}

/** "преди 12 мин" / "12 min ago" relative to an explicit reference instant (telemetry: asOf). */
export function formatRelative(
  iso: string | null | undefined,
  reference: string | number | null | undefined,
  language: Language,
): string {
  const date = validDate(iso);
  const base = typeof reference === 'number' ? new Date(reference) : validDate(reference);
  if (!date || !base || Number.isNaN(base.getTime())) {
    return emptyValue;
  }
  const text = uiMessages[language].relative;
  const seconds = Math.round((base.getTime() - date.getTime()) / 1000);
  const span = Math.abs(seconds);
  if (span < 60) {
    return text.now;
  }
  const minutes = Math.floor(span / 60);
  const hours = Math.floor(minutes / 60);
  const value =
    minutes < 60
      ? interpolate(text.minutes, { count: minutes })
      : hours < 48
        ? interpolate(text.hours, { count: hours })
        : interpolate(text.days, { count: Math.floor(hours / 24) });
  return interpolate(seconds >= 0 ? text.past : text.future, { value });
}

/** "1 ч 07 мин" / "1 h 07 min"; under an hour only minutes. */
export function formatDuration(seconds: number | null | undefined, language: Language): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return emptyValue;
  }
  const text = uiMessages[language].duration;
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) {
    return interpolate(text.minutes, { minutes });
  }
  return `${interpolate(text.hours, { hours })} ${interpolate(text.minutes, {
    minutes: String(minutes).padStart(2, '0'),
  })}`;
}
