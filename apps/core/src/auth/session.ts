import { UnauthorizedException } from '@nestjs/common';
import type { RequestContext } from '../graphql/request-context.js';
import type { UserRole } from '../generated/graphql/types.js';

export interface SessionIdentity {
  tenantId: string;
  userId: string;
  sessionId: string;
  role: UserRole;
}

export function requireSession(context: RequestContext): SessionIdentity {
  if (!context.tenantId || !context.userId || !context.sessionId || !context.role) {
    throw new UnauthorizedException('Sign in first');
  }
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    sessionId: context.sessionId,
    role: context.role,
  };
}
