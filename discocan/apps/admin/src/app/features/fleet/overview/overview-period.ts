import { isoToZonedParts, zonedWallTimeToIso } from '../../../ui/format/zoned-time';

export type OverviewDays = 7 | 14 | 30;
export type OverviewFilter = 'all' | 'live' | 'waiting' | 'disconnected' | 'connected';

/** The same Branch calendar boundaries drive totals and the Trips date filter. */
export function overviewPeriod(days: OverviewDays, timeZone: string, now: string) {
  const today = isoToZonedParts(now, timeZone);
  if (!today) {
    throw new Error('The dashboard needs a valid snapshot time.');
  }
  const end = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const tomorrow = new Date(end);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const midnight = (date: Date) =>
    zonedWallTimeToIso(
      {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: 0,
        minute: 0,
      },
      timeZone,
    );
  return {
    days,
    from: midnight(start),
    to: midnight(tomorrow),
    fromDate: start.toISOString().slice(0, 10),
    toDate: end.toISOString().slice(0, 10),
  };
}
