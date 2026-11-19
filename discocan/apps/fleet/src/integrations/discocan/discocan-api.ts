import { ServiceUnavailableException } from '@nestjs/common';

export async function requestDeviceServer<T>(
  path: string,
  options: { query?: Record<string, string>; body?: object; parse: (value: unknown) => T },
): Promise<T> {
  const unavailable = () => new ServiceUnavailableException('Device server data is unavailable');
  try {
    const token = process.env.DEVICE_SERVER_TOKEN;
    const url = new URL(process.env.DEVICE_SERVER_URL ?? 'http://127.0.0.1:11019');
    if (
      !token ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      throw unavailable();
    }
    url.pathname = path;
    url.search = new URLSearchParams(options.query).toString();
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(options.body ? 10_000 : 5000),
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body ? { method: 'POST', body: JSON.stringify(options.body) } : {}),
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw unavailable();
    }
    return options.parse(await response.json());
  } catch {
    throw unavailable();
  }
}
