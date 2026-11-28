export const salesTimeZone = 'Europe/Sofia';

const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: salesTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function salesDate(reference: Date): string {
  return dateFormat.format(reference);
}
