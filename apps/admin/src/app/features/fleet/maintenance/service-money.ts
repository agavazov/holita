/** Exact EUR decimal text to cents within the service contract; no floating-point rounding. */
export function serviceEuroCents(value: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 100_000_000 ? cents : null;
}
