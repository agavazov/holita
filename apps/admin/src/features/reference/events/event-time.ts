import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);
export { dayjs };
export const eventTimezone = 'Europe/Sofia';
export function eventTime(value: string): Dayjs {
  return dayjs(value).tz(eventTimezone);
}
export function eventInputInstant(value: string, original?: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    dayjs.utc(value).format('YYYY-MM-DDTHH:mm') !== value
  )
    throw new Error('Choose a valid date and time.');
  // An untouched minute-precision input preserves the exact stored instant and autumn offset.
  if (original && eventTime(original).format('YYYY-MM-DDTHH:mm') === value)
    return dayjs(original).toISOString();
  const instant = dayjs.tz(value, eventTimezone);
  if (instant.format('YYYY-MM-DDTHH:mm') !== value)
    throw new Error(
      'This local time does not exist because the clocks change. Choose another time.',
    );
  return instant.toISOString();
}
