import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { print } from 'graphql';
import { verifyBranch } from '@osnova/auth';
import { BranchForFleetCreationDocument } from '../../generated/graphql/core-operations.js';
import type { RequestContext } from '../../graphql/request-context.js';

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
    try {
      const result = await verifyBranch(this.url, branchId, {
        authorization: context.authorization,
        requestId,
        query: print(BranchForFleetCreationDocument),
      });
      if (!result.validResponse) {
        throw new Error('Core returned an invalid GraphQL response');
      }
      if (result.missing) {
        throw new NotFoundException('Branch not found');
      }
      if (!result.found) {
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
