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

function unavailable(): never {
  throw new ServiceUnavailableException('Karma monitoring source is unavailable');
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
    // Live background reads exceed the public four-second deadline; Fleet allows 21 seconds.
    const signal = AbortSignal.timeout(45000);
    const parameters = new URLSearchParams({
      car: query.carId,
      device: body.deviceId,
      date_type: 'utc',
      from_id: String(query.from - 1),
      'event_type[]': '33',
      'fields[]': 'pdt',
    });
    if (body.afterId === '0') {
      parameters.set(
        'from_date',
        new Date(body.fromUtc).toISOString().slice(0, 19).replace('T', ' '),
      );
      parameters.set('to_date', new Date(body.toUtc).toISOString().slice(0, 19).replace('T', ' '));
    }
    const source = await this.karma.readDiagnosticEvents(parameters, signal);
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
    for (const { event: row } of rows) {
      const id = Number(row.id);
      if (
        row.carId !== body.carId ||
        row.deviceId !== body.deviceId ||
        id <= previous ||
        id < query.from - 1
      ) {
        unavailable();
      }
      previous = id;
    }
    const selected = rows.filter(({ event }) => Number(event.id) >= query.from);
    const newest = selected.at(-1);
    return {
      highWatermark: newest?.event.id ?? body.afterId,
      hasMore: source.length === diagnosticHistoryLimits.maxRows,
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
}
