import type { FilterCondition } from '../../../ui/filter-builder/filter-model';
import { zonedWallTimeToIso } from '../../../ui/format/zoned-time';

function midnight(day: string, timeZone: string, offset = 0): number {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, date + offset));
  return Date.parse(
    zonedWallTimeToIso(
      {
        year: calendar.getUTCFullYear(),
        month: calendar.getUTCMonth() + 1,
        day: calendar.getUTCDate(),
        hour: 0,
        minute: 0,
      },
      timeZone,
    ),
  );
}

export function observationRange(condition: FilterCondition, timeZone: string) {
  const [first = '', last = first] = condition.values;
  const from =
    condition.operator === 'before'
      ? -Infinity
      : midnight(first, timeZone, condition.operator === 'after' ? 1 : 0);
  const to =
    condition.operator === 'after'
      ? Infinity
      : midnight(
          condition.operator === 'between' ? last : first,
          timeZone,
          condition.operator === 'before' ? 0 : 1,
        );
  return { from, to };
}
