import { inject, Injectable, InjectionToken } from '@angular/core';

export interface OperatorRuntimeConfig {
  graphqlUrl: string;
}
export const OPERATOR_RUNTIME_CONFIG = new InjectionToken<OperatorRuntimeConfig>(
  'operator runtime config',
  {
    providedIn: 'root',
    factory: () => ({ graphqlUrl: '/graphql' }),
  },
);
@Injectable({ providedIn: 'root' })
export class OperatorConfig {
  readonly graphqlUrl = inject(OPERATOR_RUNTIME_CONFIG).graphqlUrl;
}

export function readGraphqlUrl(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('graphqlUrl' in value) ||
    typeof value.graphqlUrl !== 'string' ||
    !value.graphqlUrl.trim()
  ) {
    throw new Error('config.json requires graphqlUrl.');
  }
  const endpoint = value.graphqlUrl.trim();
  const url =
    endpoint.startsWith('/') && !endpoint.startsWith('//')
      ? new URL(endpoint, window.location.origin)
      : new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('graphqlUrl must be an HTTP URL without credentials or a fragment.');
  }
  return endpoint;
}

/**
 * The optional, Git-ignored `config.local.json` holds developer browser keys. A 404, or a
 * server's HTML fallback page instead of JSON, means there is none.
 */
export async function loadLocalConfig<T>(parse: (value: unknown) => T, empty: T): Promise<T> {
  const response = await fetch('/config.local.json', { signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) {
    return empty;
  }
  if (!response.ok) {
    throw new Error('Could not load local configuration.');
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return empty;
  }
  const value: unknown = await response.json();
  return parse(value);
}

export function readPrimeUiLicense(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('config.local.json must be an object.');
  }
  if (!('primeUiLicense' in value)) {
    return undefined;
  }
  if (typeof value.primeUiLicense !== 'string') {
    throw new Error('primeUiLicense must be a string.');
  }
  return value.primeUiLicense.trim() || undefined;
}

export async function loadRuntimeConfig<T>(parse: (value: unknown) => T): Promise<T> {
  const response = await fetch('/config.json', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error('Could not load public admin configuration.');
  }
  const value: unknown = await response.json();
  return parse(value);
}
