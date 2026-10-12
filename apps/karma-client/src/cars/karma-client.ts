import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  KarmaCar,
  KarmaEdataInput,
  KarmaEdataPage,
  KarmaLocation,
  KarmaProject,
  KarmaTimeZone,
  KarmaVersion,
  KarmaTripsInput,
  KarmaEventsInput,
  KarmaDrivingProfileInput,
} from '../generated/graphql/types.js';
import { location } from '../location/location-response.js';
import { projects, timeZones, version } from '../references/references-response.js';
import { edataParameters, edataQuery } from '../edata/edata-query.js';
import { historyQuery, historyParameters, profileParameters } from '../history/history-query.js';
import { tripsPage, eventsPage, drivingProfile } from '../history/history-response.js';
import { edataPage } from '../edata/edata-response.js';
import { users, roles } from '../accounts/accounts-response.js';

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
  const timeZone = value['time_zone'];
  const drivers = value['driver_ids'];
  if (
    timeZone !== null &&
    timeZone !== undefined &&
    (typeof timeZone !== 'number' ||
      !Number.isInteger(timeZone) ||
      timeZone < 0 ||
      timeZone > 2147483647)
  )
    throw unavailable();
  if (drivers !== null && drivers !== undefined && !Array.isArray(drivers)) throw unavailable();
  return {
    id: identifier(value['car_id']),
    projectId: identifier(value['project_id']),
    deviceId,
    carNumber,
    carType: text(value['car_type']),
    carYear: typeof year === 'number' && Number.isFinite(year) ? String(year) : text(year),
    carColor: text(value['car_color']),
    subType: text(value['sub_type']),
    timeZoneId: typeof timeZone === 'number' ? timeZone : null,
    driverCount: Array.isArray(drivers) ? drivers.length : null,
  };
}

@Injectable()
export class KarmaClient {
  private session: string | undefined;
  private login: Promise<string> | undefined;

  async listUsers() {
    return users(await this.read('users', new URLSearchParams()));
  }

  async listRoles() {
    return roles(await this.read('roles', new URLSearchParams()));
  }

  async listCars(): Promise<KarmaCar[]> {
    return this.readCars();
  }

  async getCar(id: string): Promise<KarmaCar | null> {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      throw new BadRequestException('Invalid Karma car ID');
    const cars = await this.readCars(id);
    if (cars.length > 1 || (cars[0] && cars[0].id !== id)) throw unavailable();
    return cars[0] ?? null;
  }

  async getEdata(input: KarmaEdataInput): Promise<KarmaEdataPage> {
    const query = edataQuery(input);
    const data = await this.read('edata', edataParameters(query));
    return edataPage(data, query);
  }

  async getTrips(input: KarmaTripsInput) {
    const query = historyQuery(input, 'trips');
    const signal = AbortSignal.timeout(4000);
    const cars = await this.readCars(query.carId, signal);
    if (cars.length > 1 || (cars[0] && cars[0].id !== query.carId)) throw unavailable();
    if (!cars.length) return tripsPage([], query);
    const result = tripsPage(
      await this.read('trips', historyParameters(query), false, signal),
      query,
    );
    const last = result.items.at(-1);
    if (!result.hasMore && last && Number(last.id) > 1) {
      const older = {
        ...query,
        before: Number(last.id) - 1,
        snapshot: query.snapshot ?? Number(result.items[0]?.id),
      };
      const lookahead = tripsPage(
        await this.read('trips', historyParameters(older), false, signal),
        older,
      );
      if (lookahead.items.length) return { ...result, hasMore: true, nextCursor: lookahead.cursor };
    }
    return result;
  }

  async getEvents(input: KarmaEventsInput) {
    const query = historyQuery(input, 'events');
    const signal = AbortSignal.timeout(4000);
    const cars = await this.readCars(query.carId, signal);
    if (cars.length > 1 || (cars[0] && cars[0].id !== query.carId)) throw unavailable();
    if (!cars.length) return eventsPage([], query);
    return eventsPage(await this.read('events', historyParameters(query), false, signal), query);
  }

  async getDrivingProfile(input: KarmaDrivingProfileInput) {
    const parameters = profileParameters(input);
    const signal = AbortSignal.timeout(4000);
    const cars = await this.readCars(input.carId, signal);
    if (cars.length > 1 || (cars[0] && cars[0].id !== input.carId)) throw unavailable();
    if (!cars.length) return null;
    return drivingProfile(
      await this.read('driving-profile', parameters, false, signal),
      input.carId,
    );
  }

  async listProjects(): Promise<KarmaProject[]> {
    return projects(await this.read('projects', new URLSearchParams()));
  }

  async listTimeZones(): Promise<KarmaTimeZone[]> {
    return timeZones(await this.read('time-zones', new URLSearchParams()));
  }

  async getVersion(): Promise<KarmaVersion> {
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
      return version(data);
    } catch {
      throw unavailable();
    }
  }

  async getLocation(carId: string): Promise<KarmaLocation | null> {
    if (!/^[1-9]\d*$/.test(carId) || !Number.isSafeInteger(Number(carId)))
      throw new BadRequestException('Invalid Karma car ID');
    const signal = AbortSignal.timeout(4000);
    const cars = await this.readCars(carId, signal);
    if (cars.length > 1 || (cars[0] && cars[0].id !== carId)) throw unavailable();
    if (!cars.length) return null;
    const parameters = new URLSearchParams({ car: carId });
    for (const field of ['spd', 'odo', 'edt_tz', 'pdt']) parameters.append('fields[]', field);
    return location(await this.read('location', parameters, false, signal), carId);
  }

  private async readCars(carId?: string, signal?: AbortSignal): Promise<KarmaCar[]> {
    const data = await this.read(
      carId ? `cars/${carId}` : 'cars',
      new URLSearchParams(),
      !!carId,
      signal,
    );
    if (!Array.isArray(data)) throw unavailable();
    const cars = data.map((value: unknown) => car(value));
    if (new Set(cars.map((entry) => entry.id)).size !== cars.length) throw unavailable();
    return cars;
  }

  private async read(
    path: string,
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
