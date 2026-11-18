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

export async function loadRuntimeConfig<T>(parse: (value: unknown) => T): Promise<T> {
  const response = await fetch('/config.json', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error('Could not load public admin configuration.');
  }
  const value: unknown = await response.json();
  return parse(value);
}
