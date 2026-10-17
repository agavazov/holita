import { Injectable, ServiceUnavailableException } from '@nestjs/common';

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('Karma is unavailable; try again later');
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type KarmaResource =
  | 'cars'
  | 'edata'
  | 'location'
  | 'trips'
  | 'events'
  | 'driving-profile'
  | 'projects'
  | 'time-zones'
  | 'users'
  | 'roles';

@Injectable()
export class KarmaTransport {
  private session: string | undefined;
  private login: Promise<string> | undefined;

  read(resource: KarmaResource, parameters: URLSearchParams, signal?: AbortSignal) {
    return this.readAuthenticated(resource, parameters, false, signal);
  }

  readCar(id: string, signal?: AbortSignal) {
    return this.readAuthenticated(`cars/${id}`, new URLSearchParams(), true, signal);
  }

  async readVersion(): Promise<unknown> {
    try {
      const response = await fetch(this.url('version'), {
        signal: AbortSignal.timeout(4000),
        redirect: 'error',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw unavailable();
      }
      const data: unknown = await response.json();
      return data;
    } catch {
      throw unavailable();
    }
  }

  private async readAuthenticated(
    path: KarmaResource | `cars/${string}`,
    parameters: URLSearchParams,
    missingCar = false,
    signal = AbortSignal.timeout(4000),
  ): Promise<unknown> {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const session = await this.authenticate(signal);
        const url = this.url(path);
        url.search = parameters.toString();
        url.searchParams.set('karma_sid', session);
        const response = await fetch(url, {
          signal,
          redirect: 'error',
          headers: { accept: 'application/json' },
        });
        if (response.status === 401) {
          await response.body?.cancel();
          if (this.session === session) this.session = undefined;
          continue;
        }
        if (response.status === 404 && missingCar) {
          await response.body?.cancel();
          return [];
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw unavailable();
        }
        const data: unknown = await response.json();
        const expired = record(data) && data['error'] === 'Not logged in';
        if (expired) {
          // An older response must not discard a newer session established by another request.
          if (this.session === session) this.session = undefined;
          continue;
        }
        return data;
      }
      throw unavailable();
    } catch {
      // Upstream errors and URLs can contain account credentials or session IDs.
      throw unavailable();
    }
  }

  private url(path: string): URL {
    const url = new URL(process.env.KARMA_API_URL ?? 'https://karma.online/apiv2/');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw unavailable();
    url.pathname = url.pathname.replace(/\/$/, '') + '/' + path;
    return url;
  }

  private async authenticate(signal: AbortSignal): Promise<string> {
    if (this.session) return this.session;
    if (!this.login) {
      this.login = this.signIn(signal).finally(() => {
        this.login = undefined;
      });
    }
    return this.login;
  }

  private async signIn(signal: AbortSignal): Promise<string> {
    const user = process.env.KARMA_USER;
    const password = process.env.KARMA_PASSWORD;
    if (!user || !password) throw unavailable();
    const response = await fetch(this.url('login'), {
      method: 'POST',
      signal,
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user, password }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw unavailable();
    }
    const data: unknown = await response.json();
    if (!record(data) || typeof data['session_id'] !== 'string' || !data['session_id'])
      throw unavailable();
    this.session = data['session_id'];
    return this.session;
  }
}
