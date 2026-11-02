import { Injectable } from '@nestjs/common';
import {
  KarmaDeviceReadsClient,
  KarmaDeviceReadError,
} from '../../integrations/karma/karma-device-reads.client.js';
import type { Prisma } from '../../generated/prisma/client.js';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function invalid(): never {
  throw new KarmaDeviceReadError('INVALID_READBACK');
}
function identifier(value: unknown, zero = false): string {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d*)$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    (!zero && Number(value) < 1)
  ) {
    invalid();
  }
  return value;
}
function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    invalid();
  }
  return value;
}
function instant(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    invalid();
  }
  return new Date(value);
}
function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    invalid();
  }
  return value;
}
// JSON.parse produces JSON, while this predicate narrows unknown without trusting HTTP types.
function json(value: unknown): Prisma.InputJsonValue {
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => (item === null ? null : json(item)));
  }
  if (record(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, item === null ? null : json(item)]),
    );
  }
  return invalid();
}

@Injectable()
export class KarmaMonitoringSourceService {
  constructor(private readonly karma: KarmaDeviceReadsClient) {}

  async status() {
    const result = await this.karma.monitoring('status');
    if (!Array.isArray(result)) {
      invalid();
    }
    const trucks = result.map((row: unknown) => {
      if (
        !record(row) ||
        typeof row.deviceId !== 'string' ||
        !row.deviceId ||
        row.deviceId.length > 128 ||
        typeof row.displayName !== 'string' ||
        row.displayName.length > 256
      ) {
        invalid();
      }
      return {
        karmaCarId: identifier(row.carId),
        karmaDeviceId: row.deviceId,
        displayName: row.displayName,
        lastDataAt: instant(row.lastDataAt),
      };
    });
    if (new Set(trucks.map((truck) => truck.karmaCarId)).size !== trucks.length) {
      invalid();
    }
    return trucks;
  }

  async history(truck: {
    karmaCarId: string;
    karmaDeviceId: string;
    historyCursor: string;
    historyBeforeId: string | null;
  }) {
    const result = await this.karma.monitoring('history', {
      carId: truck.karmaCarId,
      deviceId: truck.karmaDeviceId,
      afterId: truck.historyCursor,
      ...(truck.historyBeforeId ? { beforeId: truck.historyBeforeId } : {}),
    });
    if (!record(result) || !Array.isArray(result.reports) || result.reports.length > 500) {
      invalid();
    }
    return {
      highWatermark: identifier(result.highWatermark, true),
      nextBeforeId: result.nextBeforeId === null ? null : identifier(result.nextBeforeId),
      reports: result.reports.map((report: unknown) => {
        if (
          !record(report) ||
          !Array.isArray(report.faults) ||
          typeof report.reportCode !== 'string' ||
          typeof report.decoding !== 'string'
        ) {
          invalid();
        }
        return {
          messageId: identifier(report.messageId),
          occurredAt: instant(report.occurredAt),
          rawRecord: json(report.rawRecord),
          reportCode: report.reportCode,
          decoding: report.decoding,
          faults: report.faults.map((fault: unknown) => {
            if (!record(fault) || typeof fault.status !== 'string') {
              invalid();
            }
            return {
              code: nullableText(fault.code),
              spn: nullableInteger(fault.spn),
              fmi: nullableInteger(fault.fmi),
              faultStatus: fault.status,
            };
          }),
        };
      }),
    };
  }
}
