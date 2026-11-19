export function ermTelemetryEnabled(): boolean {
  const value = process.env.FLEET_ERM_TELEMETRY_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_ERM_TELEMETRY_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}

export function ermEdataMeasurementsEnabled(): boolean {
  const value = process.env.FLEET_ERM_EDATA_MEASUREMENTS_ENABLED ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error('FLEET_ERM_EDATA_MEASUREMENTS_ENABLED must be true or false');
  }
  return value === 'true' && process.env.FLEET_ENABLED !== 'false';
}

export function ermNotificationsEnabled(): boolean {
  return Boolean(process.env.ERM_TELEMETRY_TOKEN);
}
