export function textError(value: string, max: number, requiredMessage = '') {
  if (!value.trim()) return requiredMessage;
  if (value.includes('\u0000')) return 'Remove unsupported characters.';
  return Array.from(value.trim()).length > max ? `Use at most ${String(max)} characters.` : '';
}
