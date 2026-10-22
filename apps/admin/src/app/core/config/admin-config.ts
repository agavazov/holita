import { inject, Injectable, InjectionToken } from '@angular/core';

export interface AdminRuntimeConfig {
  graphqlUrl: string;
  primeUiLicense?: string;
  googleMapsEmbedApiKey?: string;
  fleetEnabled?: boolean;
}

export const ADMIN_RUNTIME_CONFIG = new InjectionToken<AdminRuntimeConfig>('admin runtime config', {
  providedIn: 'root',
  factory: () => ({ graphqlUrl: '/graphql' }),
});

function readGraphqlUrl(value: unknown): string {
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

export function readAdminConfig(value: unknown): AdminRuntimeConfig {
  const graphqlUrl = readGraphqlUrl(value);
  const fleet =
    typeof value === 'object' && value !== null && 'fleetEnabled' in value
      ? value.fleetEnabled
      : undefined;
  if (fleet !== undefined && typeof fleet !== 'boolean') {
    throw new Error('fleetEnabled must be a boolean.');
  }
  const availability = fleet === undefined ? {} : { fleetEnabled: fleet };
  const maps = readGoogleMapsConfig(value);
  if (typeof value === 'object' && value !== null && 'primeUiLicense' in value) {
    if (typeof value.primeUiLicense !== 'string') {
      throw new Error('primeUiLicense must be a string.');
    }
    const primeUiLicense = value.primeUiLicense.trim();
    return { graphqlUrl, ...availability, ...maps, ...(primeUiLicense ? { primeUiLicense } : {}) };
  }
  return { graphqlUrl, ...availability, ...maps };
}

function readGoogleMapsConfig(value: unknown): Pick<AdminRuntimeConfig, 'googleMapsEmbedApiKey'> {
  if (typeof value !== 'object' || value === null || !('googleMapsEmbedApiKey' in value)) {
    return {};
  }
  if (typeof value.googleMapsEmbedApiKey !== 'string') {
    throw new Error('googleMapsEmbedApiKey must be a string.');
  }
  const googleMapsEmbedApiKey = value.googleMapsEmbedApiKey.trim();
  return googleMapsEmbedApiKey ? { googleMapsEmbedApiKey } : {};
}

/** Optional developer browser keys in the Git-ignored `config.local.json`. */
export interface LocalAdminConfig {
  primeUiLicense?: string;
  googleMapsEmbedApiKey?: string;
}

export function readLocalAdminConfig(value: unknown): LocalAdminConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('config.local.json must be an object.');
  }
  const unknownKey = Object.keys(value).find(
    (key) => key !== 'primeUiLicense' && key !== 'googleMapsEmbedApiKey',
  );
  if (unknownKey) {
    throw new Error(`config.local.json does not support "${unknownKey}".`);
  }
  if (!('primeUiLicense' in value)) {
    return readGoogleMapsConfig(value);
  }
  if (typeof value.primeUiLicense !== 'string') {
    throw new Error('primeUiLicense must be a string.');
  }
  const primeUiLicense = value.primeUiLicense.trim();
  return { ...readGoogleMapsConfig(value), ...(primeUiLicense ? { primeUiLicense } : {}) };
}

@Injectable({ providedIn: 'root' })
export class AdminConfig {
  readonly graphqlUrl = inject(ADMIN_RUNTIME_CONFIG).graphqlUrl;
  readonly fleetEnabled = inject(ADMIN_RUNTIME_CONFIG).fleetEnabled ?? true;
  readonly googleMapsEmbedApiKey = inject(ADMIN_RUNTIME_CONFIG).googleMapsEmbedApiKey;
}
