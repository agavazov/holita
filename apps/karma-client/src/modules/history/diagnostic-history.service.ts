import { Injectable } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type {
  KarmaDiagnosticHistory,
  KarmaDiagnosticHistoryInput,
} from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { CarsService } from '../cars/cars.service.js';
import {
  diagnosticHistoryCursor,
  diagnosticHistoryLimits,
  diagnosticHistoryParameters,
  diagnosticHistoryQuery,
} from './diagnostic-history-query.js';
import { diagnosticReport } from './diagnostic-report.js';
import { positionEventRows } from './history-response.js';

@Injectable()
export class DiagnosticHistoryService {
  constructor(
    private readonly karma: KarmaTransport,
    private readonly cars: CarsService,
  ) {}

  async read(
    input: KarmaDiagnosticHistoryInput,
    context: RequestContext,
  ): Promise<KarmaDiagnosticHistory> {
    requireTenant(context);
    const query = diagnosticHistoryQuery(input);
    const result: KarmaDiagnosticHistory = {
      carId: query.carId,
      items: [],
      cursor: input.cursor ?? null,
      nextCursor: null,
      hasMore: false,
      retrieval: 'COMPLETE',
      reason: 'NONE',
      historyComplete: false,
      scannedRows: 0,
      retrievedAt: new Date().toISOString(),
      ...diagnosticHistoryLimits,
    };
    const signal = AbortSignal.timeout(result.deadlineMs);
    let source: unknown;
    try {
      const car = await this.cars.find(query.carId, context, signal);
      if (!car) {
        result.retrieval = 'UNAVAILABLE';
        result.reason = 'CAR_NOT_FOUND';
        return result;
      }
      source = await this.karma.readDiagnosticEvents(diagnosticHistoryParameters(query), signal);
    } catch {
      result.retrieval = 'UNAVAILABLE';
      result.reason = 'UPSTREAM_FAILURE';
      return result;
    } finally {
      result.retrievedAt = new Date().toISOString();
    }
    try {
      if (!Array.isArray(source) || source.length > result.maxRows) {
        throw new Error('Invalid diagnostic event batch');
      }
      const rows = positionEventRows(source);
      let previous = 0;
      for (const event of rows) {
        const id = Number(event.id);
        if (
          event.carId !== query.carId ||
          id <= previous ||
          id < query.from - 1 ||
          (query.before !== null && id > query.before + 1) ||
          !['2', '33', '70'].includes(event.eventId)
        ) {
          throw new Error('Invalid diagnostic event scope');
        }
        previous = id;
      }
      let oldest: number | undefined;
      for (const event of rows.reverse()) {
        if (
          Number(event.id) < query.from ||
          (query.before !== null && Number(event.id) > query.before)
        ) {
          continue;
        }
        result.scannedRows++;
        oldest = Number(event.id);
        const report = diagnosticReport(event);
        if (report) {
          result.items.push(report);
        }
        if (result.items.length >= query.pageSize) {
          break;
        }
      }
      // A nonempty batch offers an older bounded read; it never proves a complete fault inventory.
      if (oldest !== undefined && oldest > query.from) {
        result.hasMore = true;
        result.nextCursor = diagnosticHistoryCursor(query, oldest - 1);
      }
      return result;
    } catch {
      result.items = [];
      result.retrieval = 'UNAVAILABLE';
      result.reason = 'INCOMPATIBLE_SOURCE';
      return result;
    }
  }
}
