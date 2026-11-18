/** Wall-clock parts in a named time zone (month 1–12). */
export interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, value);
  }
  return value;
}

function zonedFields(epoch: number, timeZone: string) {
  const fields: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(epoch))) {
    if (part.type !== 'literal') {
      fields[part.type] = Number(part.value);
    }
  }
  return {
    year: fields.year ?? 0,
    month: fields.month ?? 1,
    day: fields.day ?? 1,
    hour: fields.hour ?? 0,
    minute: fields.minute ?? 0,
    second: fields.second ?? 0,
  };
}

/** The zone's offset from UTC (ms) at an instant, from Intl's wall-clock rendering. */
function offsetAt(epoch: number, timeZone: string): number {
  const wall = zonedFields(epoch, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

/** The wall-clock parts of an ISO instant in a time zone; `null` for an invalid instant. */
export function isoToZonedParts(iso: string, timeZone: string): ZonedParts | null {
  const epoch = new Date(iso).getTime();
  if (Number.isNaN(epoch)) {
    return null;
  }
  const { year, month, day, hour, minute } = zonedFields(epoch, timeZone);
  return { year, month, day, hour, minute };
}

/**
 * The UTC ISO instant of a wall-clock time in a zone (DST-aware). A time skipped by a spring
 * gap resolves after the gap; an ambiguous autumn time resolves to its first occurrence.
 */
export function zonedWallTimeToIso(parts: ZonedParts, timeZone: string): string {
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const earlier = wall - offsetAt(wall - offsetAt(wall, timeZone), timeZone);
  const offsets = [offsetAt(earlier - 3_600_000, timeZone), offsetAt(earlier, timeZone)];
  // Prefer the earliest instant whose wall clock equals the requested time (autumn overlap).
  for (const offset of offsets.sort((a, b) => b - a)) {
    const candidate = wall - offset;
    if (offsetAt(candidate, timeZone) === offset) {
      return new Date(candidate).toISOString();
    }
  }
  return new Date(earlier).toISOString();
}

/** Floating wall time for a native date/time input, independent of the browser's DST rules. */
export function isoToZonedWallTime(iso: string, timeZone: string): string | null {
  const parts = isoToZonedParts(iso, timeZone);
  if (!parts) {
    return null;
  }
  const instant = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(instant.getUTCSeconds())}.${String(instant.getUTCMilliseconds()).padStart(3, '0')}`;
}

/** Actual instants of strict wall-clock input, earliest first; invalid/skipped times have none. */
export function zonedWallTimeInstants(date: string | null, timeZone: string): readonly number[] {
  const match = date
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(date)
    : null;
  if (!match) {
    return [];
  }
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const second = Number(match[6] ?? 0),
    millisecond = Number((match[7] ?? '').padEnd(3, '0'));
  const calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    calendar.getUTCFullYear() !== parts.year ||
    calendar.getUTCMonth() + 1 !== parts.month ||
    calendar.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    second > 59
  ) {
    return [];
  }
  const first = Date.parse(zonedWallTimeToIso(parts, timeZone));
  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    second,
    millisecond,
  );
  const occurrences = new Set<number>();
  // Nearby offsets cover repeated times including half-hour and multi-hour DST changes.
  for (const shift of [-86_400_000, 0, 86_400_000]) {
    const probe = first + shift;
    const fields = isoToZonedParts(new Date(probe).toISOString(), timeZone);
    if (!fields) {
      continue;
    }
    const offset =
      Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute) -
      Math.floor(probe / 60_000) * 60_000;
    const candidate = wall - offset;
    const repeated = isoToZonedParts(new Date(candidate).toISOString(), timeZone);
    if (
      repeated?.year === parts.year &&
      repeated.month === parts.month &&
      repeated.day === parts.day &&
      repeated.hour === parts.hour &&
      repeated.minute === parts.minute
    ) {
      occurrences.add(candidate);
    }
  }
  return [...occurrences].sort((left, right) => left - right);
}

/** A DatePicker `Date` (local calendar day) as `YYYY-MM-DD`. */
export function toDateOnly(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` as a local-midnight `Date` for a DatePicker; `null` when not a real date. */
export function fromDateOnly(text: string | null | undefined): Date | null {
  const match = text ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}
