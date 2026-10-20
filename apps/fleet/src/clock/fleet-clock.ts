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

/** Calendar date (`YYYY-MM-DD`) in the configured Branch time zone. */
export function businessDate(instant: Date, timeZone = BUSINESS_TIME_ZONE): string {
  const businessDateFormat = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = new Map(
    businessDateFormat.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return `${parts.get('year') ?? ''}-${parts.get('month') ?? ''}-${parts.get('day') ?? ''}`;
}

/** Adds whole calendar days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  return dateToDateOnly(new Date(dateOnlyToDate(date).getTime() + days * 86_400_000));
}

/** Half-open `(start, end]` statistics window ending at the Branch data clock. */
export interface DataWindow {
  readonly start: Date;
  readonly end: Date;
}

/** The `days` before the data clock `asOf`; `null` when the Branch has no device data. */
export function dataWindow(asOf: Date | null, days: number): DataWindow | null {
  return asOf === null ? null : { start: new Date(asOf.getTime() - days * 86_400_000), end: asOf };
}
