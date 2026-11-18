import { readDemoTenant } from '@osnova/auth';
import { readSession } from '@osnova/auth';
import { isUserRole } from '../auth/roles.js';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RequestContext {
  requestId: string;
  tenantId: string | undefined;
  userId?: string | undefined;
  sessionId?: string | undefined;
  branchId: string | undefined;
  authorization: string | undefined;
  branchChecks: Map<string, Promise<void>>;
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
  const header = req.headers['x-branch-id'];
  const authorization = req.headers.authorization;
  res.setHeader('x-request-id', requestId);
  const isSession = /^[Bb][Ee][Aa][Rr][Ee][Rr] [a-z0-9-]+-session\./.test(authorization ?? '');
  const verified = isSession ? await readSession(authorization) : undefined;
  const identity = verified && isUserRole(verified.role) ? verified : undefined;
  return {
    requestId,
    tenantId: isSession ? identity?.tenantId : readDemoTenant(authorization),
    userId: identity?.userId,
    sessionId: identity?.sessionId,
    branchId: typeof header === 'string' ? header : undefined,
    authorization,
    branchChecks: new Map(),
  };
}
