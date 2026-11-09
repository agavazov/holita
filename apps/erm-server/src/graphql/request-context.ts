import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readDemoTenant } from '../auth/demo-auth.js';
import { readSession } from '../auth/session-auth.js';
import type { UserRole } from '../auth/roles.js';

export interface RequestContext {
  requestId: string;
  tenantId: string | undefined;
  userId?: string | undefined;
  sessionId?: string | undefined;
  role?: UserRole | undefined;
  authorization?: string | undefined;
  branchId?: string | undefined;
}

export async function createRequestContext({
  req,
  res,
}: {
  req: IncomingMessage;
  res: ServerResponse;
}): Promise<RequestContext> {
  const supplied = req.headers['x-request-id'];
  const requestId =
    typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
      ? supplied
      : randomUUID();
  res.setHeader('x-request-id', requestId);
  const branchId = req.headers['x-branch-id'];
  const authorization = req.headers.authorization;
  const isSession = /^Bearer discocan-session\./i.test(authorization ?? '');
  const identity = isSession ? await readSession(authorization) : undefined;
  const tenantId = isSession ? identity?.tenantId : readDemoTenant(authorization);
  return {
    requestId,
    tenantId,
    userId: identity?.userId,
    sessionId: identity?.sessionId,
    role: isSession ? identity?.role : tenantId ? 'ADMINISTRATOR' : undefined,
    authorization,
    branchId: typeof branchId === 'string' ? branchId : undefined,
  };
}
