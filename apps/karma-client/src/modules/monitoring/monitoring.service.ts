import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { cars } from '../cars/cars-response.js';
import { location } from '../location/location-response.js';
import {
  diagnosticHistoryParameters,
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
      !Number.isSafeInteger(Number(body.afterId))
    ) {
      throw new BadRequestException('Invalid monitoring history target');
    }
    const beforeId = 'beforeId' in body && body.beforeId !== null ? body.beforeId : undefined;
    if (beforeId !== undefined && typeof beforeId !== 'string') {
      throw new BadRequestException('Invalid history cursor');
    }
    const query = diagnosticHistoryQuery({
      carId: body.carId,
      pageSize: 100,
      fromMessageId: String(Number(body.afterId) + 1),
      ...(beforeId ? { toMessageId: beforeId } : {}),
    });
    const signal = AbortSignal.timeout(4000);
    const source = await this.karma.readDiagnosticEvents(
      diagnosticHistoryParameters(query),
      signal,
    );
    if (!Array.isArray(source) || source.length > 500) {
      unavailable();
    }
    const rows = positionEventRows(source);
    let previous = 0;
    for (const row of rows) {
      const id = Number(row.id);
      if (
        row.carId !== body.carId ||
        row.deviceId !== body.deviceId ||
        id <= previous ||
        id < query.from - 1 ||
        (query.before !== null && id > query.before + 1) ||
        !['2', '33', '70'].includes(row.eventId)
      ) {
        unavailable();
      }
      previous = id;
    }
    const selected = rows.filter(
      (row) =>
        Number(row.id) >= query.from && (query.before === null || Number(row.id) <= query.before),
    );
    const oldest = selected[0];
    const newest = selected.at(-1);
    return {
      highWatermark: newest?.id ?? body.afterId,
      nextBeforeId: oldest && Number(oldest.id) > query.from ? String(Number(oldest.id) - 1) : null,
      reports: selected.flatMap((event) => {
        const report = diagnosticReport(event);
        const rawRecord: unknown = source[rows.indexOf(event)];
        return report && report.family !== 'SPECIAL_ACK' && report.family !== 'EDATA_411'
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
