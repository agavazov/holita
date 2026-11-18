import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  boolean,
  date,
  dateOrNull,
  integer,
  integerOrNull,
  oneOf,
  recordOf,
  rowsOf,
  text,
  textOrNull,
} from '../../database/sql.js';
import type { RequestContext } from '../../graphql/request-context.js';
import type { FleetScope } from '../../validation.js';

export interface ErmDashboardUnit {
  imei: string;
  connected: boolean;
  lastFrameAt: Date | null;
  expectedIntervalSeconds: number;
  reporting: boolean;
}

export interface ErmDashboardTelemetry {
  asOf: Date;
  units: ErmDashboardUnit[];
}

function evidence(row: Record<string, unknown>) {
  return {
    sourceKind: oneOf(row, 'sourceKind', ['DIAGNOSTIC', 'ALARM', 'COMMAND'] as const),
    sourceId: text(row, 'sourceId'),
    imei: text(row, 'imei'),
    deviceId: textOrNull(row, 'deviceId'),
    occurredAt: date(row, 'occurredAt'),
    severity: oneOf(row, 'severity', ['INFO', 'WARNING', 'CRITICAL'] as const),
    state: oneOf(row, 'state', ['RECORDED', 'FAILED', 'UNCERTAIN', 'EXPIRED'] as const),
    code: text(row, 'code'),
    details: textOrNull(row, 'details'),
    eventTime: dateOrNull(row, 'eventTime'),
    eventId: textOrNull(row, 'eventId'),
    diagnostics: rowsOf(row.diagnostics, (diagnostic) => ({
      kind: oneOf(diagnostic, 'kind', [
        'DIAGNOSTIC_TROUBLE_CODE',
        'CAN_ERROR',
        'CAN_DISCONNECTED',
      ] as const),
      troubleCode: textOrNull(diagnostic, 'troubleCode'),
      status:
        diagnostic.status === null
          ? null
          : oneOf(diagnostic, 'status', ['ADDED', 'DELETED'] as const),
    })),
  };
}

export type ErmProblemEvidence = ReturnType<typeof evidence>;
export interface ErmProblemPage {
  asOf: Date;
  totalCount: number;
  hasMore: boolean;
  items: ErmProblemEvidence[];
  counts: {
    sourceKind: ErmProblemEvidence['sourceKind'];
    severity: ErmProblemEvidence['severity'];
    count: number;
  }[];
}

const telemetryQuery = `query FleetDashboardTelemetry($imeis: [String!]!) {
  ermFleetTelemetry(imeis: $imeis) {
    asOf units { imei connected lastFrameAt expectedIntervalSeconds reporting }
  }
}`;
const problemsQuery = `query FleetDashboardProblems($imeis: [String!]!, $tenantId: ID!, $branchId: ID!, $from: DateTime!, $to: DateTime!, $offset: Int!, $limit: Int!) {
  ermFleetProblems(imeis: $imeis, tenantId: $tenantId, branchId: $branchId, from: $from, to: $to, offset: $offset, limit: $limit) {
    asOf totalCount hasMore
    items { sourceKind sourceId imei deviceId occurredAt severity state code details eventTime eventId diagnostics { kind troubleCode status } }
    counts { sourceKind severity count }
  }
}`;

const faultReadsQuery = `query FleetFaultReads($offset: Int!, $limit: Int!, $filter: ErmCommandRequestsFilter!) {
  ermCommandRequests(offset: $offset, limit: $limit, filter: $filter, sort: { field: COMPLETED_AT, direction: DESC }) {
    total
    items { id deviceId unitId completedAt faultReadVerdict { activeCodes codeCount receivedAt } }
  }
}`;

export interface ErmFaultRead {
  id: string;
  deviceId: string;
  unitId: string;
  completedAt: Date;
  verdict: { activeCodes: boolean; codeCount: number | null; receivedAt: Date } | null;
}

/** Internal ERM reads; callers obtain every IMEI from verified Tenant/Branch-scoped Fleet rows. */
@Injectable()
export class ErmDashboardClient {
  async telemetry(imeis: readonly string[]): Promise<ErmDashboardTelemetry> {
    const units: ErmDashboardUnit[] = [];
    let asOf: Date | undefined;
    const unique = [...new Set(imeis)];
    for (let offset = 0; offset < unique.length; offset += 500) {
      const batch = unique.slice(offset, offset + 500);
      const value = await this.request(telemetryQuery, { imeis: batch }, 'ermFleetTelemetry');
      const observedAt = date(value, 'asOf');
      if (asOf === undefined || observedAt < asOf) {
        asOf = observedAt;
      }
      const rows = rowsOf(value.units, (row) => ({
        imei: text(row, 'imei'),
        connected: boolean(row, 'connected'),
        lastFrameAt: dateOrNull(row, 'lastFrameAt'),
        expectedIntervalSeconds: integer(row, 'expectedIntervalSeconds'),
        reporting: boolean(row, 'reporting'),
      }));
      if (
        rows.length !== batch.length ||
        new Set(rows.map((row) => row.imei)).size !== batch.length ||
        rows.some((row) => !batch.includes(row.imei))
      ) {
        throw new ServiceUnavailableException('Incomplete ERM dashboard snapshot');
      }
      units.push(...rows);
    }
    return { asOf: asOf ?? new Date(), units };
  }

  async problems(
    scope: FleetScope,
    imeis: readonly string[],
    period: { from: Date; to: Date },
    page: { offset: number; limit: number },
  ): Promise<ErmProblemPage> {
    const value = await this.request(
      problemsQuery,
      { ...scope, imeis, ...period, ...page },
      'ermFleetProblems',
    );
    const items = rowsOf(value.items, evidence);
    if (items.some((item) => !imeis.includes(item.imei))) {
      throw new ServiceUnavailableException('Invalid ERM dashboard scope');
    }
    return {
      asOf: date(value, 'asOf'),
      totalCount: integer(value, 'totalCount'),
      hasMore: boolean(value, 'hasMore'),
      items,
      counts: rowsOf(value.counts, (row) => ({
        sourceKind: oneOf(row, 'sourceKind', ['DIAGNOSTIC', 'ALARM', 'COMMAND'] as const),
        severity: oneOf(row, 'severity', ['INFO', 'WARNING', 'CRITICAL'] as const),
        count: integer(row, 'count'),
      })),
    };
  }

  /**
   * Answered fault-logger reads (GET DTC) with their eData verdicts, newest completion first,
   * created within the period. It forwards the caller's session and Branch, so ERM applies its
   * own Tenant/Branch scope; it reads at most `count` requests.
   */
  async faultReads(
    context: Pick<RequestContext, 'authorization' | 'branchId'>,
    filter: { deviceIds: readonly string[] | null; from: Date; to: Date },
    count: number,
  ): Promise<{ total: number; items: ErmFaultRead[] }> {
    const { authorization, branchId } = context;
    if (!authorization || !branchId) {
      throw new ServiceUnavailableException('ERM fault reads need a signed-in Branch session');
    }
    const items: ErmFaultRead[] = [];
    let total = 0;
    for (let offset = 0; offset < count; offset += 100) {
      const limit = Math.min(100, count - offset);
      const value = await this.request(
        faultReadsQuery,
        {
          offset,
          limit,
          filter: {
            actions: ['READ_EDATA_FAULTS'],
            statuses: ['ANSWERED'],
            ...(filter.deviceIds ? { deviceIds: filter.deviceIds } : {}),
            createdFrom: filter.from.toISOString(),
            createdTo: filter.to.toISOString(),
          },
        },
        'ermCommandRequests',
        { authorization, branchId },
      );
      total = integer(value, 'total');
      const rows = rowsOf(value.items, (row) => {
        const verdict = row.faultReadVerdict === null ? null : recordOf(row.faultReadVerdict);
        return {
          id: text(row, 'id'),
          deviceId: text(row, 'deviceId'),
          unitId: text(row, 'unitId'),
          completedAt: date(row, 'completedAt'),
          verdict: verdict && {
            activeCodes: boolean(verdict, 'activeCodes'),
            codeCount: integerOrNull(verdict, 'codeCount'),
            receivedAt: date(verdict, 'receivedAt'),
          },
        };
      });
      items.push(...rows);
      if (rows.length < limit || items.length >= total) {
        break;
      }
    }
    return { total, items };
  }

  private async request(
    query: string,
    variables: object,
    field: string,
    caller?: { authorization: string; branchId: string },
  ): Promise<Record<string, unknown>> {
    const token = process.env.ERM_TELEMETRY_TOKEN;
    const authorization = caller
      ? { authorization: caller.authorization, 'x-branch-id': caller.branchId }
      : token && token.length >= 32
        ? { authorization: `Bearer ${token}` }
        : null;
    if (!authorization) {
      throw new ServiceUnavailableException('ERM dashboard access is not configured');
    }
    try {
      const url = new URL(process.env.ERM_TELEMETRY_URL ?? 'http://127.0.0.1:11017');
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      ) {
        throw new Error('Invalid ERM API URL');
      }
      url.pathname = '/graphql';
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: { 'content-type': 'application/json', ...authorization },
        body: JSON.stringify({ query, variables }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('ERM request failed');
      }
      const payload: unknown = await response.json();
      const body = recordOf(payload);
      if (body.errors !== undefined) {
        throw new Error('ERM query failed');
      }
      return recordOf(recordOf(body.data)[field]);
    } catch {
      throw new ServiceUnavailableException('ERM dashboard data is unavailable');
    }
  }
}
