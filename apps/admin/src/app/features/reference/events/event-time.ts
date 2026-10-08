import dayjs from 'dayjs/esm/index.js';
import utc from 'dayjs/esm/plugin/utc/index.js';
import timezone from 'dayjs/esm/plugin/timezone/index.js';
import type { Language } from '../../../i18n/messages';

dayjs.extend(utc);
dayjs.extend(timezone);
export { dayjs };
export const eventTimezone = 'Europe/Sofia';
const calendarOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};
const timeOptions: Intl.DateTimeFormatOptions = {
  ...calendarOptions,
  timeZone: eventTimezone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};
const timeFormatters = {
  bg: new Intl.DateTimeFormat('bg-BG', timeOptions),
  en: new Intl.DateTimeFormat('en-GB', timeOptions),
};
const calendarFormatters = {
  bg: new Intl.DateTimeFormat('bg-BG', calendarOptions),
  en: new Intl.DateTimeFormat('en-GB', calendarOptions),
};
export function eventTime(value: string) {
  return dayjs(value).tz(eventTimezone);
}
export function formatEventTime(value: string, language: Language): string {
  return timeFormatters[language].format(new Date(value));
}
export function formatEventCalendarDate(value: string, language: Language): string {
  return calendarFormatters[language].format(new Date(value));
}
export function validCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayjs.utc(value).format('YYYY-MM-DD') === value;
}
export function eventInputInstant(value: string, original?: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    dayjs.utc(value).format('YYYY-MM-DDTHH:mm') !== value
  )
    throw new Error('dateTime');
  // Unchanged minute inputs preserve stored seconds, milliseconds and either autumn offset.
  if (original && eventTime(original).format('YYYY-MM-DDTHH:mm') === value)
    return dayjs(original).toISOString();
  const instant = dayjs.tz(value, eventTimezone);
  if (instant.format('YYYY-MM-DDTHH:mm') !== value) throw new Error('missingTime');
  return instant.toISOString();
}
