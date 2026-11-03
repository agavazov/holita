export function sqlRows(value: unknown): Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (row: unknown): row is Record<string, unknown> =>
        typeof row === 'object' && row !== null && !Array.isArray(row),
    )
  ) {
    throw new Error('Invalid ERM database rows');
  }
  return value;
}

export function sqlText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new Error(`Invalid ERM database field: ${key}`);
  }
  return value;
}

export function sqlNullableText(row: Record<string, unknown>, key: string): string | null {
  return row[key] === null ? null : sqlText(row, key);
}

export function sqlNullableDate(row: Record<string, unknown>, key: string): Date | null {
  const value = row[key];
  if (value === null || (value instanceof Date && Number.isFinite(value.getTime()))) {
    return value;
  }
  throw new Error(`Invalid ERM database date: ${key}`);
}

export function sqlInteger(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`Invalid ERM database integer: ${key}`);
  }
  return value;
}
