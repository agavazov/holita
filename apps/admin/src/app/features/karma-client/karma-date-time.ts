/** DatePicker strings carry the API's clock fields without interpreting a browser time zone. */
export function karmaDateControl(value: string): string {
  const normalized = value.length === 16 ? `${value}:00` : value;
  return normalized.replace('T', ' ');
}

/** Keep bookmarked filters and API parameters in their existing ISO-like wall-clock form. */
export function karmaDateParameter(value: string | null): string {
  return value?.replace(' ', 'T') ?? '';
}

/** The date grid cell owns selection; its child must not duplicate aria-selected. */
export const karmaDatePickerPt = { day: { 'aria-selected': null } };
