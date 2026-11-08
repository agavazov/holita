import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { karmaConfig, type KarmaConfig } from './karma.config.js';

function unavailable(reason = 'unavailable'): ServiceUnavailableException {
  return new ServiceUnavailableException('Karma routing is unavailable', reason);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function karmaFailureReason(error: unknown): string {
  if (error instanceof ServiceUnavailableException) {
    const response = error.getResponse();
    const reason = record(response) ? response['error'] : undefined;
    if (
      typeof reason === 'string' &&
      /^(missing car mapping|timeout|HTTP [1-5]\d{2}|not logged in)$/.test(reason)
    ) {
      return reason;
    }
  }
  return 'unavailable';
}

function identifier(value: unknown): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw unavailable();
  }
  return String(value);
}

@Injectable()
export class KarmaTransport {
  private session: string | undefined;

  async readCars(): Promise<{ carId: string; unitId: string }[]> {
    const rows = await this.read('cars', new URLSearchParams());
    if (!Array.isArray(rows)) {
      throw unavailable();
    }
    return rows.map((row: unknown) => {
      if (!record(row) || typeof row['device_id'] !== 'string') {
        throw unavailable();
      }
      return { carId: identifier(row['car_id']), unitId: row['device_id'] };
    });
  }

  async readEvents(
    carId: string,
    from: Date,
    to: Date,
    unitId: string,
  ): Promise<{ reportedAt: Date; parked: boolean }[]> {
    const rows = await this.read(
      'events',
      new URLSearchParams({
        car: carId,
        from_date: from.toISOString().slice(0, 19).replace('T', ' '),
        to_date: to.toISOString().slice(0, 19).replace('T', ' '),
        date_type: 'utc',
      }),
    );
    if (!Array.isArray(rows) || rows.length > 500) {
      throw unavailable();
    }
    return rows.map((row: unknown) => {
      if (
        !record(row) ||
        identifier(row['car_id']) !== carId ||
        row['device_id'] !== unitId ||
        typeof row['edt'] !== 'string' ||
        !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row['edt']) ||
        typeof row['eid'] !== 'number' ||
        !Number.isSafeInteger(row['eid']) ||
        row['eid'] < 0
      ) {
        throw unavailable();
      }
      // The former client treats edt as UTC; edt_tz is the separate local clock.
      const iso = row['edt'].replace(' ', 'T') + '.000Z';
      const reportedAt = new Date(iso);
      if (
        !Number.isFinite(reportedAt.getTime()) ||
        reportedAt.toISOString() !== iso ||
        reportedAt.getTime() < Math.floor(from.getTime() / 1000) * 1000 ||
        reportedAt > to
      ) {
        throw unavailable();
      }
      const ignition = typeof row['extra'] === 'string' ? row['extra'].split(',')[0]?.trim() : null;
      return {
        reportedAt,
        parked: row['eid'] === 5 || (row['eid'] === 1 && ignition === '0'),
      };
    });
  }

  async requestReturn(carId: string): Promise<{
    status: 'ACCEPTED' | 'UNCERTAIN';
    queueId: string | null;
  }> {
    const config = this.config();
    const signal = AbortSignal.timeout(30_000);
    let session: string;
    try {
      session = await this.authenticate(config, signal);
    } catch {
      throw unavailable();
    }
    try {
      const response = await fetch(new URL('commands', config.apiUrl), {
        method: 'POST',
        signal,
        redirect: 'error',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          car_id: [carId],
          message: `98,1,${config.recoveryHost},${String(config.recoveryPort)}`,
          karma_sid: session,
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401) {
          this.session = undefined;
        }
        return { status: 'UNCERTAIN', queueId: null };
      }
      const rows: unknown = await response.json();
      if (record(rows) && rows['error'] === 'Not logged in') {
        this.session = undefined;
      }
      if (!Array.isArray(rows) || rows.length !== 1) {
        return { status: 'UNCERTAIN', queueId: null };
      }
      return { status: 'ACCEPTED', queueId: identifier(rows[0]) };
    } catch {
      // A lost response can follow acceptance. Never replay this submission.
      return { status: 'UNCERTAIN', queueId: null };
    }
  }

  private async read(path: 'cars' | 'events', parameters: URLSearchParams): Promise<unknown> {
    const config = this.config();
    // Karma events reads took 7–29 s on 2026-11-06.
    const signal = AbortSignal.timeout(60_000);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const session = await this.authenticate(config, signal);
        const url = new URL(path, config.apiUrl);
        url.search = parameters.toString();
        url.searchParams.set('karma_sid', session);
        const response = await fetch(url, {
          signal,
          redirect: 'error',
          headers: { accept: 'application/json' },
        });
        if (response.status === 401) {
          await response.body?.cancel();
          this.session = undefined;
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw unavailable(`HTTP ${String(response.status)}`);
        }
        const data: unknown = await response.json();
        if (record(data) && data['error'] === 'Not logged in') {
          this.session = undefined;
          continue;
        }
        return data;
      }
      throw unavailable('not logged in');
    } catch (error) {
      // Upstream URLs/errors can contain account credentials or session IDs.
      throw unavailable(signal.aborted ? 'timeout' : karmaFailureReason(error));
    }
  }

  private config(): KarmaConfig {
    const config = karmaConfig();
    if (!config) {
      throw unavailable();
    }
    return config;
  }

  private async authenticate(config: KarmaConfig, signal: AbortSignal): Promise<string> {
    if (this.session) {
      return this.session;
    }
    const response = await fetch(new URL('login', config.apiUrl), {
      method: 'POST',
      signal,
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: config.user, password: config.password }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw unavailable(`HTTP ${String(response.status)}`);
    }
    const data: unknown = await response.json();
    if (!record(data) || typeof data['session_id'] !== 'string' || !data['session_id']) {
      throw unavailable('not logged in');
    }
    this.session = data['session_id'];
    return this.session;
  }
}
