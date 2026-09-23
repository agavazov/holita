export function getDatabaseUrl(): string {
  const value =
    process.env.CORE_DATABASE_URL ??
    'postgresql://holita_core:holita_core_local@127.0.0.1:11084/holita_core';
  try {
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new Error('CORE_DATABASE_URL must be a valid PostgreSQL URL');
  }
  return value;
}
