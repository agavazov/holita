import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { print } from 'graphql';
import {
  StoreForVenueCreationDocument,
  type StoreForVenueCreationQueryVariables,
} from '../generated/graphql/core-operations.js';
import type { RequestContext } from '../graphql/request-context.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class CoreClient {
  private readonly logger = new Logger(CoreClient.name);
  private readonly url = process.env.CORE_GRAPHQL_URL ?? 'http://127.0.0.1:11082/graphql';

  requireStore(storeId: string, context: RequestContext): Promise<void> {
    const existing = context.storeChecks.get(storeId);
    if (existing) return existing;
    const check = this.lookupStore(storeId, context.requestId);
    context.storeChecks.set(storeId, check);
    return check;
  }

  private async lookupStore(storeId: string, requestId: string): Promise<void> {
    const variables: StoreForVenueCreationQueryVariables = { id: storeId };
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-request-id': requestId },
        body: JSON.stringify({ query: print(StoreForVenueCreationDocument), variables }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error('Core returned an HTTP error');
      const body: unknown = await response.json();
      if (
        !isRecord(body) ||
        (body.errors !== undefined && (!Array.isArray(body.errors) || body.errors.length > 0)) ||
        !isRecord(body.data)
      ) {
        throw new Error('Core returned an invalid GraphQL response');
      }
      if (body.data.store === null) throw new NotFoundException('Store not found');
      if (!isRecord(body.data.store) || body.data.store.id !== storeId)
        throw new Error('Core returned an invalid store');
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn({
        message: 'Core store validation failed',
        requestId,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new ServiceUnavailableException('Store validation is unavailable; try again later');
    }
  }
}
