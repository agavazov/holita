import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { SalesAgent } from '../generated/graphql/types.js';

function isSalesAgent(value: unknown): value is SalesAgent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    isUUID(value.id) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'active' in value &&
    typeof value.active === 'boolean' &&
    'eligible' in value &&
    typeof value.eligible === 'boolean'
  );
}

@Injectable()
export class CoreSalesAgents {
  async lookup(
    authorization: string,
    lookup: { ids: string[]; historicalIds?: string[] } | { search: string },
  ): Promise<SalesAgent[]> {
    const url = new URL(
      '/internal/sales-agents/lookup',
      process.env.CORE_AUTH_VERIFY_URL ?? 'http://127.0.0.1:12011/internal/auth/verify',
    );
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization,
          'content-type': 'application/json',
          'x-core-internal-token': process.env.CORE_INTERNAL_AUTH_TOKEN ?? '',
        },
        body: JSON.stringify(lookup),
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (response.status === 401) {
        throw new UnauthorizedException('Sign in first');
      }
      if (response.status === 403) {
        throw new ForbiddenException('A platform Sales account is required');
      }
      if (response.ok) {
        const data: unknown = await response.json();
        if (Array.isArray(data) && data.every(isSalesAgent)) {
          return data;
        }
      }
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
    }
    throw new ServiceUnavailableException('Sales agent lookup is unavailable');
  }
}
