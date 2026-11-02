import { Injectable } from '@nestjs/common';
import { requireTenant } from '../../auth/demo-auth.js';
import type { KarmaDailyReportInput, KarmaTrip } from '../../generated/graphql/types.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { KarmaTransport } from '../../integrations/karma/karma-transport.js';
import { CarsService } from '../cars/cars.service.js';
import { timeZones } from '../references/references-response.js';
import {
  dailyReportInput,
  dailyReportLimits,
  dailyReportPeriod,
  dailyReportTrips,
} from './daily-report-query.js';
import { dailyReportResult, initialDailyReport } from './daily-report-response.js';

@Injectable()
export class DailyReportService {
  constructor(
    private readonly karma: KarmaTransport,
    private readonly cars: CarsService,
  ) {}

  async report(input: KarmaDailyReportInput, context: RequestContext) {
    requireTenant(context);
    const selection = dailyReportInput(input);
    const report = initialDailyReport(selection.carId, selection.day);
    const signal = AbortSignal.timeout(dailyReportLimits.deadlineMs);
    const trips: KarmaTrip[] = [];
    let zonesResponse: unknown;
    try {
      report.car = await this.cars.find(selection.carId, context, signal);
      if (!report.car) {
        report.retrieval = 'UNAVAILABLE';
        report.reason = 'CAR_NOT_FOUND';
        return dailyReportResult(report, trips);
      }
      zonesResponse = await this.karma.read('time-zones', new URLSearchParams(), signal);
    } catch {
      report.retrieval = 'UNAVAILABLE';
      report.reason = 'UPSTREAM_FAILURE';
      return dailyReportResult(report, trips);
    }
    try {
      report.timeZone =
        timeZones(zonesResponse).find((zone) => zone.id === report.car?.timeZoneId) ?? null;
    } catch {
      report.retrieval = 'UNAVAILABLE';
      report.reason = 'INCOMPATIBLE_SOURCE';
      return dailyReportResult(report, trips);
    }
    if (report.timeZone?.name !== 'Europe/Sofia') {
      report.state = 'UNSUPPORTED_PERIOD';
      report.reason = 'TIME_ZONE_NOT_PROVEN';
      return dailyReportResult(report, trips);
    }
    const period = dailyReportPeriod(selection.day, report.timeZone.name, new Date());
    report.day = period.day;
    report.fromLocal = period.fromLocal;
    report.toLocalExclusive = period.toLocalExclusive;
    report.fromUtc = period.fromUtc;
    report.toUtcExclusive = period.toUtcExclusive;
    if (period.open) {
      report.state = 'UNSUPPORTED_PERIOD';
      report.reason = 'OPEN_DAY';
      return dailyReportResult(report, trips);
    }
    let before: number | null = null;
    while (report.pageRequests < dailyReportLimits.maxPages) {
      const parameters = new URLSearchParams(period.parameters);
      parameters.set('car', selection.carId);
      if (before !== null) {
        parameters.set('to_id', String(before));
      }
      let response: unknown;
      report.pageRequests++;
      try {
        response = await this.karma.readReportTrips(parameters, signal);
      } catch {
        report.retrieval = trips.length ? 'PARTIAL' : 'UNAVAILABLE';
        report.state = trips.length ? 'PARTIAL' : 'UNAVAILABLE';
        report.reason = 'UPSTREAM_FAILURE';
        return dailyReportResult(report, trips);
      }
      let batch: KarmaTrip[];
      try {
        batch = dailyReportTrips(response, selection.carId, period, before);
      } catch {
        report.retrieval = trips.length ? 'PARTIAL' : 'UNAVAILABLE';
        report.state = trips.length ? 'PARTIAL' : 'UNAVAILABLE';
        report.reason = 'INCOMPATIBLE_SOURCE';
        return dailyReportResult(report, trips);
      }
      if (!batch.length) {
        report.retrieval = 'COMPLETE';
        return dailyReportResult(report, trips);
      }
      const remaining = dailyReportLimits.maxRows - trips.length;
      if (remaining > 0) {
        trips.push(...batch.slice(-remaining));
      }
      if (batch.length > remaining) {
        report.retrieval = 'PARTIAL';
        report.state = 'PARTIAL';
        report.reason = 'ROW_LIMIT';
        return dailyReportResult(report, trips);
      }
      if (report.pageRequests === 1) {
        const from = Number(batch.at(-1)?.id) + 1;
        const upperParameters = new URLSearchParams(period.parameters);
        upperParameters.set('car', selection.carId);
        upperParameters.set('from_id', String(from));
        report.pageRequests++;
        let upperResponse: unknown;
        try {
          upperResponse = await this.karma.readReportTrips(upperParameters, signal);
        } catch {
          report.retrieval = 'PARTIAL';
          report.state = 'PARTIAL';
          report.reason = 'UPSTREAM_FAILURE';
          return dailyReportResult(report, trips);
        }
        let upperBatch: KarmaTrip[];
        try {
          upperBatch = dailyReportTrips(upperResponse, selection.carId, period, null, from);
        } catch {
          report.retrieval = 'PARTIAL';
          report.state = 'PARTIAL';
          report.reason = 'INCOMPATIBLE_SOURCE';
          return dailyReportResult(report, trips);
        }
        if (upperBatch.length) {
          report.retrieval = 'PARTIAL';
          report.state = 'PARTIAL';
          report.reason = 'SOURCE_BOUNDARY_NOT_PROVEN';
          return dailyReportResult(report, trips);
        }
      }
      before = Number(batch[0]?.id) - 1;
    }
    report.retrieval = 'PARTIAL';
    report.state = 'PARTIAL';
    report.reason = 'PAGE_LIMIT';
    return dailyReportResult(report, trips);
  }
}
