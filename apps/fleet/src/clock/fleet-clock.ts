import { Injectable } from '@nestjs/common';
import { BUSINESS_TIME_ZONE } from '../fleet-thresholds.js';
import { dateOnlyToDate, dateToDateOnly } from '../graphql/scalars.js';

/**
 * Write time and the source of the business date. Database specs override it to fix the
 * business date; nothing else in Fleet reads the wall clock for business rules.
 */
@Injectable()
export class FleetClock {
  now(): Date {
    return new Date();
  }
}

const businessDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date (`YYYY-MM-DD`) of an instant in the business time zone (Europe/Sofia). */
export function businessDate(instant: Date): string {
  const parts = new Map(
    businessDateFormat.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return `${parts.get('year') ?? ''}-${parts.get('month') ?? ''}-${parts.get('day') ?? ''}`;
}

/** Adds whole calendar days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  return dateToDateOnly(new Date(dateOnlyToDate(date).getTime() + days * 86_400_000));
}
