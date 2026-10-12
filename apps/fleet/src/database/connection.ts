export function getDatabaseUrl(): string {
  const value =
    process.env.FLEET_DATABASE_URL ??
    'postgresql://holita_fleet:holita_fleet_local@127.0.0.1:11084/holita_fleet';
  try {
    const url = new URL(value);
    if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new Error('FLEET_DATABASE_URL must be a valid PostgreSQL URL');
  }
  return value;
}
