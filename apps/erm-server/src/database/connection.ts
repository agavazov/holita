export function getDatabaseUrl(): string {
  const value =
    process.env.ERM_DATABASE_URL ??
    'postgresql://holita_erm:holita_erm_local@127.0.0.1:11084/holita_erm';
  try {
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new Error('ERM_DATABASE_URL must be a valid PostgreSQL URL');
  }
  return value;
}
