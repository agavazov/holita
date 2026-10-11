import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { KarmaCar } from '../generated/graphql/types.js';

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException('Karma is unavailable; try again later');
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw unavailable();
  return String(value);
}

function text(value: unknown, required = false): string | null {
  if (typeof value === 'string') return value;
  if (!required && (value === null || value === undefined)) return null;
  throw unavailable();
}

function car(value: unknown): KarmaCar {
  if (!record(value)) throw unavailable();
  const deviceId = text(value['device_id'], true);
  const carNumber = text(value['car_number'], true);
  if (deviceId === null || carNumber === null) throw unavailable();
  const year = value['car_year'];
  return {
    id: identifier(value['car_id']),
    projectId: identifier(value['project_id']),
    deviceId,
    carNumber,
    carType: text(value['car_type']),
    carYear: typeof year === 'number' && Number.isFinite(year) ? String(year) : text(year),
    carColor: text(value['car_color']),
  };
}

@Injectable()
export class KarmaClient {
  private session: string | undefined;
  private login: Promise<string> | undefined;

  async listCars(): Promise<KarmaCar[]> {
    const signal = AbortSignal.timeout(4000);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const session = await this.authenticate(signal);
        const url = this.url('cars');
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
        const data: unknown = await response.json();
        const expired = record(data) && data['error'] === 'Not logged in';
        if (expired) {
          // An older response must not discard a newer session established by another request.
          if (this.session === session) this.session = undefined;
          continue;
        }
        if (!response.ok || !Array.isArray(data)) throw unavailable();
        const cars = data.map((value: unknown) => car(value));
        if (new Set(cars.map((entry) => entry.id)).size !== cars.length) throw unavailable();
        return cars;
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
    const data: unknown = await response.json();
    if (
      !response.ok ||
      !record(data) ||
      typeof data['session_id'] !== 'string' ||
      !data['session_id']
    )
      throw unavailable();
    this.session = data['session_id'];
    return this.session;
  }
}
