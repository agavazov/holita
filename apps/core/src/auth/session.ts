import { UnauthorizedException } from '@nestjs/common';
import type { RequestContext } from '../graphql/request-context.js';

export interface SessionIdentity {
  tenantId: string;
  userId: string;
  sessionId: string;
}

export function requireSession(context: RequestContext): SessionIdentity {
  if (!context.tenantId || !context.userId || !context.sessionId) {
    throw new UnauthorizedException('Sign in first');
  }
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    sessionId: context.sessionId,
  };
}
