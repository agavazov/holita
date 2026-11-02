import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { KarmaDailyReportInput, KarmaTrip } from '../../generated/graphql/types.js';
import { tripRows } from './history-response.js';

export const dailyReportLimits = { maxPages: 4, maxRows: 1000, deadlineMs: 4000 };

function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dailyReportInput(input: KarmaDailyReportInput) {
  if (
    !/^[1-9]\d*$/.test(input.carId) ||
    !Number.isSafeInteger(Number(input.carId)) ||
    (input.day !== undefined && input.day !== null && !validDay(input.day))
  ) {
    throw new BadRequestException('Invalid Karma daily report selection');
  }
  return { carId: input.carId, day: input.day ?? null };
}

function localTimestamp(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function midnightUtc(day: string, timeZone: string): string {
  const midnight = `${day}T00:00:00`;
  const calendar = new Date(`${midnight}Z`).getTime();
  let instant = calendar;
  // Resolve each local midnight separately, including the offset on DST transition days.
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = localTimestamp(new Date(instant), timeZone);
    if (local === midnight) {
      return new Date(instant).toISOString();
    }
    instant += calendar - new Date(`${local}Z`).getTime();
  }
  throw new ServiceUnavailableException('Karma is unavailable; try again later');
}

export function dailyReportPeriod(day: string | null, timeZone: string, now: Date) {
  const today = localTimestamp(now, timeZone).slice(0, 10);
  const selected = day ?? shiftDay(today, -1);
  const nextDay = shiftDay(selected, 1);
  return {
    day: selected,
    open: selected >= today,
    fromLocal: `${selected}T00:00:00`,
    toLocalExclusive: `${nextDay}T00:00:00`,
    fromUtc: midnightUtc(selected, timeZone),
    toUtcExclusive: midnightUtc(nextDay, timeZone),
    parameters: new URLSearchParams({
      from_date: `${selected} 00:00:00`,
      to_date: `${selected} 23:59:59`,
    }),
  };
}

function validSourceTimestamp(value: string): boolean {
  const normalized = value.replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) && date.toISOString() === normalized.replace('Z', '.000Z');
}

export function dailyReportTrips(
  value: unknown,
  carId: string,
  period: ReturnType<typeof dailyReportPeriod>,
  before: number | null,
  from: number | null = null,
): KarmaTrip[] {
  const rows = tripRows(value);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const previous = rows[index - 1];
    if (
      !row ||
      row.carId !== carId ||
      (previous && Number(previous.id) >= Number(row.id)) ||
      (before !== null && Number(row.id) > before) ||
      (from !== null && Number(row.id) < from) ||
      !row.startDate ||
      !validSourceTimestamp(row.startDate) ||
      row.startDate.replace(' ', 'T') < period.fromLocal ||
      row.startDate.replace(' ', 'T') >= period.toLocalExclusive ||
      (row.stopDate !== null && row.stopDate !== undefined && !validSourceTimestamp(row.stopDate))
    ) {
      throw new ServiceUnavailableException('Karma is unavailable; try again later');
    }
  }
  return rows;
}
