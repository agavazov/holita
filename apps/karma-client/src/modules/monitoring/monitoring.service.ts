import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { cars } from '../cars/cars-response.js';
import { location } from '../location/location-response.js';
import {
  diagnosticHistoryLimits,
  diagnosticHistoryQuery,
} from '../history/diagnostic-history-query.js';
import { diagnosticReport } from '../history/diagnostic-report.js';
import { positionEventRows } from '../history/history-response.js';

function unavailable(code = 'MONITORING_INVALID_RESPONSE'): never {
  throw new ServiceUnavailableException({
    message: 'Karma monitoring source is unavailable',
    code,
  });
}

function historyRows(source: unknown, carId: string, deviceId: string) {
  if (!Array.isArray(source) || source.length > diagnosticHistoryLimits.maxRows) {
    unavailable();
  }
  const rows = positionEventRows(source)
    .map((event, index) => {
      const rawRecord: unknown = source[index];
      return { event, rawRecord };
    })
    .sort((left, right) => Number(left.event.id) - Number(right.event.id));
  let previous = 0;
  for (const { event } of rows) {
    const id = Number(event.id);
    if (event.carId !== carId || event.deviceId !== deviceId || id <= previous) {
      unavailable();
    }
    previous = id;
  }
  return rows;
}

@Injectable()
export class MonitoringService {
  constructor(private readonly karma: KarmaTransport) {}

  async status() {
    const signal = AbortSignal.timeout(8000);
    const inventory = cars(await this.karma.read('cars', new URLSearchParams(), signal));
    const source = await this.karma.read(
      'location',
      new URLSearchParams({ 'fields[]': 'pdt' }),
      signal,
    );
    if (!Array.isArray(source)) {
      unavailable();
    }
    const latest = new Map<string, ReturnType<typeof location>>();
    for (const entry of source) {
      const row: unknown = entry;
      if (
        typeof row !== 'object' ||
        row === null ||
        !('car_id' in row) ||
        typeof row.car_id !== 'number'
      ) {
        unavailable();
      }
      const id = String(row.car_id);
      if (latest.has(id)) {
        unavailable();
      }
      latest.set(id, location([row], id));
    }
    return inventory.map((car) => {
      const data = latest.get(car.id);
      if (data && data.deviceId !== car.deviceId) {
        unavailable();
      }
      // edt is the source event clock; pdt has no established reception/time-zone semantics.
      const instant = data?.edt ? data.edt.replace(' ', 'T') + '.000Z' : null;
      if (
        instant &&
        (!Number.isFinite(Date.parse(instant)) || new Date(instant).toISOString() !== instant)
      ) {
        unavailable();
      }
      return {
        carId: car.id,
        deviceId: car.deviceId,
        displayName: car.carNumber,
        lastDataAt: instant,
      };
    });
  }

  async history(body: unknown) {
    if (
      typeof body !== 'object' ||
      body === null ||
      !('carId' in body) ||
      typeof body.carId !== 'string' ||
      !('deviceId' in body) ||
      typeof body.deviceId !== 'string' ||
      !body.deviceId ||
      body.deviceId.length > 128 ||
      !('afterId' in body) ||
      typeof body.afterId !== 'string' ||
      !/^(0|[1-9]\d*)$/.test(body.afterId) ||
      !Number.isSafeInteger(Number(body.afterId)) ||
      !('fromUtc' in body) ||
      typeof body.fromUtc !== 'string' ||
      !Number.isFinite(Date.parse(body.fromUtc)) ||
      !('toUtc' in body) ||
      typeof body.toUtc !== 'string' ||
      !Number.isFinite(Date.parse(body.toUtc)) ||
      Date.parse(body.fromUtc) > Date.parse(body.toUtc)
    ) {
      throw new BadRequestException('Invalid monitoring history target');
    }
    const query = diagnosticHistoryQuery({
      carId: body.carId,
      pageSize: 100,
      fromMessageId: String(Number(body.afterId) + 1),
    });
    // Share the deadline across the latest-ID lookup and the bounded catch-up page.
    const signal = AbortSignal.timeout(45000);
    const parameters = new URLSearchParams({
      car: query.carId,
      device: body.deviceId,
      date_type: 'utc',
      'event_type[]': '33',
      'fields[]': 'pdt',
    });
    // Karma's open-ended incremental scan exceeds 45 seconds even with dates.
    // Keep each catch-up range to the million IDs verified by live reads.
    const latest =
      body.afterId === '0'
        ? []
        : await this.readHistoryRows(parameters, signal, body.carId, body.deviceId);
    const latestId = Number(latest.at(-1)?.event.id ?? body.afterId);
    if (body.afterId !== '0' && latestId <= Number(body.afterId)) {
      return { highWatermark: body.afterId, hasMore: false, reports: [] };
    }
    const upper =
      body.afterId === '0' ? null : Math.min(latestId, Number(body.afterId) + 1_000_000);
    parameters.set('from_id', String(query.from - 1));
    if (upper !== null) {
      parameters.set('to_id', String(upper + 1));
    }
    parameters.set(
      'from_date',
      new Date(body.fromUtc).toISOString().slice(0, 19).replace('T', ' '),
    );
    parameters.set('to_date', new Date(body.toUtc).toISOString().slice(0, 19).replace('T', ' '));
    const rows = await this.readHistoryRows(parameters, signal, body.carId, body.deviceId);
    for (const { event: row } of rows) {
      const id = Number(row.id);
      if (id < query.from - 1 || (upper !== null && id > upper + 1)) {
        unavailable();
      }
    }
    const selected = rows.filter(
      ({ event }) =>
        Number(event.id) >= query.from && (upper === null || Number(event.id) <= upper),
    );
    const newest = selected.at(-1);
    const full = rows.length === diagnosticHistoryLimits.maxRows;
    // A short page exhausts this ID range, including gaps with no matching events.
    const highWatermark =
      upper !== null && !full ? String(upper) : (newest?.event.id ?? body.afterId);
    return {
      highWatermark,
      hasMore: upper === null ? full : Number(highWatermark) < latestId,
      reports: selected.flatMap(({ event, rawRecord }) => {
        const report = diagnosticReport(event);
        return report && ['EDATA_413', 'EDATA_418', 'EDATA_419'].includes(report.family)
          ? [
              {
                messageId: event.id,
                occurredAt: report.instantUtc,
                rawRecord,
                faults: report.faults,
                reportCode: report.reportCode,
                decoding: report.decoding,
              },
            ]
          : [];
      }),
    };
  }

  private async readHistoryRows(
    parameters: URLSearchParams,
    signal: AbortSignal,
    carId: string,
    deviceId: string,
  ) {
    let source: unknown;
    try {
      source = await this.karma.readDiagnosticEvents(parameters, signal);
    } catch {
      unavailable(signal.aborted ? 'MONITORING_TIMEOUT' : 'MONITORING_UPSTREAM_FAILED');
    }
    return historyRows(source, carId, deviceId);
  }
}
