import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { print } from 'graphql';
import {
  BranchForFleetCreationDocument,
  type BranchForFleetCreationQueryVariables,
} from '../../generated/graphql/core-operations.js';
import type { RequestContext } from '../../graphql/request-context.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class CoreClient {
  private readonly logger = new Logger(CoreClient.name);
  private readonly url = process.env.CORE_GRAPHQL_URL ?? 'http://127.0.0.1:11011/graphql';

  requireBranch(branchId: string, context: RequestContext): Promise<void> {
    const existing = context.branchChecks.get(branchId);
    if (existing) {
      return existing;
    }
    const check = this.lookupBranch(branchId, context);
    context.branchChecks.set(branchId, check);
    return check;
  }

  private async lookupBranch(branchId: string, context: RequestContext): Promise<void> {
    const { requestId } = context;
    const variables: BranchForFleetCreationQueryVariables = { id: branchId };
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': requestId,
          ...(context.authorization ? { authorization: context.authorization } : {}),
        },
        body: JSON.stringify({ query: print(BranchForFleetCreationDocument), variables }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        throw new Error('Core returned an HTTP error');
      }
      const body: unknown = await response.json();
      if (
        !isRecord(body) ||
        (body.errors !== undefined && (!Array.isArray(body.errors) || body.errors.length > 0)) ||
        !isRecord(body.data)
      ) {
        throw new Error('Core returned an invalid GraphQL response');
      }
      if (body.data.branch === null) {
        throw new NotFoundException('Branch not found');
      }
      if (!isRecord(body.data.branch) || body.data.branch.id !== branchId) {
        throw new Error('Core returned an invalid branch');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.warn({
        message: 'Core branch validation failed',
        requestId,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new ServiceUnavailableException('Branch validation is unavailable; try again later');
    }
  }
}
