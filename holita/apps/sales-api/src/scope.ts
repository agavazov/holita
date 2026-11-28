import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { readSession } from '@osnova/auth';

export interface RequestContext {
  authorization: string | undefined;
}

export interface SalesScope {
  tenantId: string;
  userId: string;
  authorization: string;
}

export async function requireSalesScope(context: RequestContext): Promise<SalesScope> {
  const { authorization } = context;
  const identity = await readSession(authorization);
  if (!authorization || !identity) {
    throw new UnauthorizedException('Sign in first');
  }
  if (!identity.platform || identity.role !== 'SALES') {
    throw new ForbiddenException('A platform Sales account is required');
  }
  return { tenantId: identity.tenantId, userId: identity.userId, authorization };
}
