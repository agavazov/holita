export function getDatabaseUrl(): string {
  const value =
    process.env.REFERENCE_DATABASE_URL ??
    'postgresql://holita_reference:holita_reference_local@127.0.0.1:11084/holita_reference';
  try {
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new Error('REFERENCE_DATABASE_URL must be a valid PostgreSQL URL');
  }
  return value;
}
