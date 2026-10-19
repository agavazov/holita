import type { Language } from '../../i18n/messages';
import { interpolate, uiMessages } from '../i18n/messages';

/** Display for an absent value; `0` is always a number. */
export const emptyValue = '—';

const locales: Readonly<Record<Language, string>> = { bg: 'bg-BG', en: 'en-GB' };

export function localeOf(language: Language): string {
  return locales[language];
}

/** Grouped number with up to `fraction` decimals; `null`/`undefined` → "—". */
export function formatNumber(
  value: number | null | undefined,
  language: Language,
  options: { readonly fraction?: number } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return emptyValue;
  return new Intl.NumberFormat(localeOf(language), {
    maximumFractionDigits: options.fraction ?? 0,
    minimumFractionDigits: 0,
    useGrouping: 'always',
  }).format(value);
}

type UnitName = keyof (typeof uiMessages)['en']['units'];

function withUnit(
  value: number | null | undefined,
  language: Language,
  unit: UnitName,
  fraction: number,
  spaced = true,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return emptyValue;
  const number = formatNumber(value, language, { fraction });
  const label = uiMessages[language].units[unit];
  return spaced ? `${number}\u00a0${label}` : `${number}${label}`;
}

export function formatDistanceKm(value: number | null | undefined, language: Language): string {
  return withUnit(value, language, 'km', 1);
}

export function formatSpeed(value: number | null | undefined, language: Language): string {
  return withUnit(value, language, 'kmh', 0);
}

export function formatLitres(value: number | null | undefined, language: Language): string {
  return withUnit(value, language, 'litre', 1);
}

export function formatVolts(value: number | null | undefined, language: Language): string {
  return withUnit(value, language, 'volt', 1);
}

export function formatPercent(value: number | null | undefined, language: Language): string {
  return withUnit(value, language, 'percent', 0, false);
}

export function formatTemperature(value: number | null | undefined, language: Language): string {
  return withUnit(value, language, 'celsius', 1);
}

/** EUR from integer cents; `null` → "—", `0` → "0,00 €". */
export function formatMoneyCents(cents: number | null | undefined, language: Language): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return emptyValue;
  return new Intl.NumberFormat(localeOf(language), {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  }).format(cents / 100);
}

function parts(date: Date, language: Language, options: Intl.DateTimeFormatOptions) {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of new Intl.DateTimeFormat(localeOf(language), options).formatToParts(date))
    values[part.type] = part.value;
  return values;
}

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `dd.MM.yyyy HH:mm` (bg) or `dd MMM yyyy, HH:mm` (en), optionally with seconds. */
export function formatDateTime(
  iso: string | null | undefined,
  language: Language,
  timeZone: string,
  seconds = false,
): string {
  const date = validDate(iso);
  if (!date) return emptyValue;
  const value = parts(date, language, {
    timeZone,
    year: 'numeric',
    month: language === 'bg' ? '2-digit' : 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    hourCycle: 'h23',
  });
  const { day = '', month = '', year = '', hour = '', minute = '' } = value;
  const time = `${hour}:${minute}${seconds ? `:${value.second ?? ''}` : ''}`;
  return language === 'bg' ? `${day}.${month}.${year} ${time}` : `${day} ${month} ${year}, ${time}`;
}

/** A calendar date (`YYYY-MM-DD`) without time-zone conversion. */
export function formatDateOnly(text: string | null | undefined, language: Language): string {
  const match = text ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;
  if (!match) return emptyValue;
  const [, year = '', month = '', day = ''] = match;
  if (language === 'bg') return `${day}.${month}.${year}`;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const { month: name = '' } = parts(date, language, { timeZone: 'UTC', month: 'short' });
  return `${day} ${name} ${year}`;
}

/** "преди 12 мин" / "12 min ago" relative to an explicit reference instant (telemetry: asOf). */
export function formatRelative(
  iso: string | null | undefined,
  reference: string | number | null | undefined,
  language: Language,
): string {
  const date = validDate(iso);
  const base = typeof reference === 'number' ? new Date(reference) : validDate(reference);
  if (!date || !base || Number.isNaN(base.getTime())) return emptyValue;
  const text = uiMessages[language].relative;
  const seconds = Math.round((base.getTime() - date.getTime()) / 1000);
  const span = Math.abs(seconds);
  if (span < 60) return text.now;
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
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0)
    return emptyValue;
  const text = uiMessages[language].duration;
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return interpolate(text.minutes, { minutes });
  return `${interpolate(text.hours, { hours })} ${interpolate(text.minutes, {
    minutes: String(minutes).padStart(2, '0'),
  })}`;
}
