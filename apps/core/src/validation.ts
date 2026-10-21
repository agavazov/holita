/** Stable reasons emitted by Core's supported-text validation. */
export type FieldErrorCode = 'REQUIRED' | 'TOO_LONG' | 'INVALID_FORMAT';

export function textErrorCode(value: string, max: number): FieldErrorCode {
  const trimmed = value.trim();
  return !trimmed ? 'REQUIRED' : Array.from(trimmed).length > max ? 'TOO_LONG' : 'INVALID_FORMAT';
}
