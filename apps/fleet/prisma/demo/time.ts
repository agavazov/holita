import { addDays, businessDate } from '../../src/clock/fleet-clock.js';

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const DEMO_ANCHOR = '2026-10-18T06:30:00.000Z';
export { addDays };
export const sofiaDate = businessDate;
const sofiaFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Sofia',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Resolve local calendar wall time through the same named business zone as Fleet. */
export function sofiaInstant(date: string, minutesOfDay: number): Date {
  const wall = Date.parse(`${date}T00:00:00.000Z`) + minutesOfDay * 60_000;
  let candidate = wall;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = sofiaFormatter.formatToParts(candidate);
    const part = (name: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === name)?.value);
    const rendered = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second'),
    );
    candidate += wall - rendered;
  }
  return new Date(candidate);
}

export function isoWeekday(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay() || 7;
}
