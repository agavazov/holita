import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class AdminConfig {
  private readonly http = inject(HttpClient);
  graphqlUrl = '/graphql';

  async load(): Promise<void> {
    this.graphqlUrl = readGraphqlUrl(await firstValueFrom(this.http.get<unknown>('/config.json')));
  }
}
