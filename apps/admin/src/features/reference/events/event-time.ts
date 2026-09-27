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
export function eventInstant(value: Dayjs): string {
  const wallTime = value.format('YYYY-MM-DD HH:mm');
  // Preserve a valid stored offset, including either occurrence of the repeated autumn hour.
  if (value.tz(eventTimezone).format('YYYY-MM-DD HH:mm') === wallTime)
    return value.second(0).millisecond(0).toISOString();
  const instant = dayjs.tz(wallTime, eventTimezone);
  if (instant.format('YYYY-MM-DD HH:mm') !== wallTime)
    throw new Error(
      'This local time does not exist because the clocks change. Choose another time.',
    );
  return instant.toISOString();
}
