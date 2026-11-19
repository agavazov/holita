export function deviceServerEnabled(): boolean {
  const value = process.env.FLEET_DEVICE_SERVER_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_DEVICE_SERVER_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}
