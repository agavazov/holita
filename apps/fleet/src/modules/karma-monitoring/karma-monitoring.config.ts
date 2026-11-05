export function ermHealthEnabled(): boolean {
  const value = process.env.FLEET_ERM_HEALTH_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_ERM_HEALTH_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}
