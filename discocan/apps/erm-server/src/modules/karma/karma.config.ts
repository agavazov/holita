export interface KarmaConfig {
  apiUrl: URL;
  user: string;
  password: string;
  recoveryHost: string;
  recoveryPort: number;
}

export function karmaConfig(): KarmaConfig | null {
  const user = process.env.KARMA_USER?.trim();
  const password = process.env.KARMA_PASSWORD;
  const endpoint = process.env.ERM_RECOVERY_ENDPOINT?.trim();
  const recovery = endpoint?.match(/^([a-zA-Z0-9][a-zA-Z0-9.-]*):([1-9]\d{0,4})$/);
  const recoveryHost = recovery?.[1];
  const recoveryPort = Number(recovery?.[2]);
  if (!user || !password || !recoveryHost || !recoveryPort || recoveryPort > 65535) {
    return null;
  }
  try {
    const apiUrl = new URL(process.env.KARMA_API_URL ?? 'https://karma.online/apiv2/');
    if (
      !['http:', 'https:'].includes(apiUrl.protocol) ||
      apiUrl.username ||
      apiUrl.password ||
      apiUrl.search ||
      apiUrl.hash
    ) {
      return null;
    }
    apiUrl.pathname = apiUrl.pathname.replace(/\/$/, '') + '/';
    return { apiUrl, user, password, recoveryHost, recoveryPort };
  } catch {
    return null;
  }
}

export function karmaEnabled(): boolean {
  return karmaConfig() !== null;
}
