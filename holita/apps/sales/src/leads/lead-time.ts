import { displayTimeZone } from '@osnova/ui';

const offsetFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: displayTimeZone,
  timeZoneName: 'longOffset',
});

export function leadUtcOffset(instant: number): string {
  const zone = offsetFormat.formatToParts(instant).find(({ type }) => type === 'timeZoneName');
  return `UTC${zone?.value.slice(3) ?? ''}`;
}

export function leadTimeOffsets(instants: readonly number[]) {
  return instants.length > 1
    ? instants.map((instant) => ({ instant, label: leadUtcOffset(instant) }))
    : [];
}
