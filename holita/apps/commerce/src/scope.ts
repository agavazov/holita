import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { readSession, verifyBranch, type SessionIdentity } from '@osnova/auth';

export interface RequestContext {
  authorization: string | undefined;
  branchId: string | undefined;
}
export interface Scope {
  tenantId: string;
  branchId: string;
}

export interface ShopperScope extends Scope {
  customerId: string;
}

export async function requireScope(context: RequestContext, write: boolean): Promise<Scope> {
  const identity: SessionIdentity | undefined = await readSession(context.authorization);
  if (!identity) {
    throw new UnauthorizedException('Sign in first');
  }
  if (identity.platform || !['VIEWER', 'OPERATOR', 'ADMINISTRATOR'].includes(identity.role)) {
    throw new ForbiddenException('A merchant account is required');
  }
  if (write && !['OPERATOR', 'ADMINISTRATOR'].includes(identity.role)) {
    throw new ForbiddenException('Your role does not permit this action');
  }
  if (!context.branchId || !isUUID(context.branchId)) {
    throw new BadRequestException('Select a Branch with a valid x-branch-id');
  }
  const branchId = context.branchId.toLowerCase();
  let found: boolean;
  try {
    const result = await verifyBranch(
      process.env.CORE_GRAPHQL_URL ?? 'http://127.0.0.1:12011/graphql',
      branchId,
      {
        authorization: context.authorization,
        query: 'query VerifyBranch($id: ID!) { branch(id: $id) { id } }',
        rejectRedirect: true,
      },
    );
    found = result.found;
  } catch {
    throw new ServiceUnavailableException('Branch verification is unavailable');
  }
  if (!found) {
    throw new ForbiddenException('Branch is unavailable');
  }
  return { tenantId: identity.tenantId, branchId };
}
