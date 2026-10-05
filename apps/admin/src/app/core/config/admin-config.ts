import { inject, Injectable, InjectionToken } from '@angular/core';

export interface AdminRuntimeConfig {
  graphqlUrl: string;
  primeUiLicense?: string;
}

export const ADMIN_RUNTIME_CONFIG = new InjectionToken<AdminRuntimeConfig>('admin runtime config', {
  providedIn: 'root',
  factory: () => ({ graphqlUrl: '/graphql' }),
});

export function readGraphqlUrl(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('graphqlUrl' in value) ||
    typeof value.graphqlUrl !== 'string' ||
    !value.graphqlUrl.trim()
  )
    throw new Error('config.json requires graphqlUrl.');
  const endpoint = value.graphqlUrl.trim();
  const url =
    endpoint.startsWith('/') && !endpoint.startsWith('//')
      ? new URL(endpoint, window.location.origin)
      : new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error('graphqlUrl must be an HTTP URL without credentials or a fragment.');
  return endpoint;
}

export function readAdminConfig(value: unknown): AdminRuntimeConfig {
  const graphqlUrl = readGraphqlUrl(value);
  if (typeof value === 'object' && value !== null && 'primeUiLicense' in value) {
    if (typeof value.primeUiLicense !== 'string')
      throw new Error('primeUiLicense must be a string.');
    const primeUiLicense = value.primeUiLicense.trim();
    return { graphqlUrl, ...(primeUiLicense ? { primeUiLicense } : {}) };
  }
  return { graphqlUrl };
}

@Injectable({ providedIn: 'root' })
export class AdminConfig {
  readonly graphqlUrl = inject(ADMIN_RUNTIME_CONFIG).graphqlUrl;
}
