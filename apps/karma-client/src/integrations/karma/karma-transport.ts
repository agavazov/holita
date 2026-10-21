import { Injectable, ServiceUnavailableException } from '@nestjs/common';

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('Karma is unavailable; try again later');
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function boundedJson(response: Response, limit: number): Promise<unknown> {
  if (!response.body) {
    throw unavailable();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      const bytes: unknown = chunk.value;
      if (!(bytes instanceof Uint8Array)) {
        await reader.cancel();
        throw unavailable();
      }
      length += bytes.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw unavailable();
      }
      text += decoder.decode(bytes, { stream: true });
    }
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    return value;
  } finally {
    reader.releaseLock();
  }
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

  readConfigurationTarget(id: string, signal: AbortSignal) {
    return this.readAuthenticated(`cars/${id}`, new URLSearchParams(), true, signal, 65536);
  }

  readConfigurationEvents(parameters: URLSearchParams, signal: AbortSignal) {
    return this.readAuthenticated('events', parameters, false, signal, 2097152);
  }

  requestConfiguration(carId: string, signal: AbortSignal) {
    return this.submitEdataCommand(carId, '0702BC', signal);
  }

  requestProfile(carId: string, signal: AbortSignal) {
    return this.submitEdataCommand(carId, '1F', signal);
  }

  requestParameter(carId: string, rawDefinition: string, signal: AbortSignal) {
    if (
      !/^[a-f\d]{44}$/i.test(rawDefinition) ||
      Number.parseInt(rawDefinition.slice(40), 16) > 65000
    ) {
      throw unavailable();
    }
    return this.submitEdataCommand(carId, `02${rawDefinition.toUpperCase()}`, signal);
  }

  private async submitEdataCommand(
    carId: string,
    payload: '0702BC' | '1F' | `02${string}`,
    signal: AbortSignal,
  ) {
    let session: string;
    try {
      session = await this.authenticate(signal);
    } catch {
      throw unavailable();
    }
    try {
      const response = await fetch(this.url('commands'), {
        method: 'POST',
        signal,
        redirect: 'error',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          car_id: [carId],
          message: `30,1,19,0,19,301,0,1,1,${payload}`,
          karma_sid: session,
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401 && this.session === session) {
          this.session = undefined;
        }
        return { status: 'UNCERTAIN' as const, queueIds: [] };
      }
      const data = await boundedJson(response, 65536);
      if (record(data) && data['error'] === 'Not logged in' && this.session === session) {
        this.session = undefined;
      }
      if (
        !Array.isArray(data) ||
        data.length === 0 ||
        data.length > 10 ||
        data.some((id: unknown) => typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) ||
        new Set(data).size !== data.length
      ) {
        return { status: 'UNCERTAIN' as const, queueIds: [] };
      }
      return { status: 'ACCEPTED' as const, queueIds: data.map((id: unknown) => String(id)) };
    } catch {
      // The provider may have accepted a request even when its response is lost.
      return { status: 'UNCERTAIN' as const, queueIds: [] };
    }
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
    bodyLimit?: number,
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
          if (this.session === session) {
            this.session = undefined;
          }
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
        const data: unknown = bodyLimit
          ? await boundedJson(response, bodyLimit)
          : await response.json();
        const expired = record(data) && data['error'] === 'Not logged in';
        if (expired) {
          // An older response must not discard a newer session established by another request.
          if (this.session === session) {
            this.session = undefined;
          }
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
    ) {
      throw unavailable();
    }
    url.pathname = url.pathname.replace(/\/$/, '') + '/' + path;
    return url;
  }

  private async authenticate(signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    if (this.session) {
      return this.session;
    }
    if (!this.login) {
      this.login = this.signIn(signal).finally(() => {
        this.login = undefined;
      });
    }
    const login = this.login;
    // A public read may join a longer background login, but keeps its own deadline.
    return new Promise<string>((resolve, reject) => {
      const abort = () => {
        reject(unavailable());
      };
      signal.addEventListener('abort', abort, { once: true });
      void login.then(
        (session) => {
          signal.removeEventListener('abort', abort);
          resolve(session);
        },
        () => {
          signal.removeEventListener('abort', abort);
          reject(unavailable());
        },
      );
    });
  }

  private async signIn(signal: AbortSignal): Promise<string> {
    const user = process.env.KARMA_USER;
    const password = process.env.KARMA_PASSWORD;
    if (!user || !password) {
      throw unavailable();
    }
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
    if (!record(data) || typeof data['session_id'] !== 'string' || !data['session_id']) {
      throw unavailable();
    }
    this.session = data['session_id'];
    return this.session;
  }
}
