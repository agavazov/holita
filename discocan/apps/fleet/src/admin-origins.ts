export function fleetAdminOrigins(value: string | undefined, legacy: string | undefined): string[] {
  const configured = value ?? legacy ?? 'http://127.0.0.1:11000,http://localhost:11000';
  const origins = configured.split(',').map((origin) => origin.trim());
  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
      } catch {
        return true;
      }
    })
  ) {
    throw new Error('ADMIN_ORIGINS must contain exact HTTP(S) origins separated by commas.');
  }
  return [...new Set(origins)];
}
