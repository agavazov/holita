import { defaultDateFormat, type FleetDateFormat, formatDateOnly } from '../format/format';
import { isoToZonedWallTime, zonedWallTimeInstants } from '../format/zoned-time';

/**
 * Text-input adapter: the Branch numeric order is explicit, independent of browser native
 * date/time controls. Seconds and milliseconds remain editable and round-trip unchanged.
 */
export function formatDateTimeInput(
  iso: string | null | undefined,
  timeZone: string,
  dateFormat: FleetDateFormat = defaultDateFormat,
): string {
  const wall = iso ? isoToZonedWallTime(iso, timeZone) : null;
  return wall ? `${formatDateOnly(wall.slice(0, 10), 'en', dateFormat)} ${wall.slice(11)}` : '';
}

/** All valid occurrences, earliest first; skipped/invalid Branch wall times return none. */
export function dateTimeInputInstants(
  text: string | null,
  timeZone: string,
  dateFormat: FleetDateFormat = defaultDateFormat,
): readonly number[] {
  if (!text) {
    return [];
  }
  const pattern =
    dateFormat === 'YYYY_MM_DD'
      ? /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/
      : dateFormat === 'DD_MM_YYYY'
        ? /^(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/
        : /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/;
  const match = pattern.exec(text);
  if (!match) {
    return [];
  }
  const [, first = '', month = '', third = '', time = ''] = match;
  const year = dateFormat === 'YYYY_MM_DD' ? first : third;
  const day = dateFormat === 'YYYY_MM_DD' ? third : first;
  return zonedWallTimeInstants(`${year}-${month}-${day}T${time}`, timeZone);
}

/**
 * Canonical UTC value for a typed editor. Preserve the original occurrence during an autumn
 * overlap; a changed ambiguous time uses the earliest occurrence. A DST gap is invalid.
 * Editors with interval bounds can select from dateTimeInputInstants instead.
 */
export function parseDateTimeInput(
  text: string | null,
  timeZone: string,
  dateFormat: FleetDateFormat = defaultDateFormat,
  original?: string | null,
): string | null {
  const candidates = dateTimeInputInstants(text, timeZone, dateFormat);
  const initial = original ? Date.parse(original) : Number.NaN;
  const selected = candidates.includes(initial) ? initial : candidates[0];
  return selected === undefined ? null : new Date(selected).toISOString();
}
