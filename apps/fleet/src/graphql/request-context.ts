import { readDemoTenant } from '../auth/demo-auth.js';
import { readSession } from '../auth/session-auth.js';
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
  const isSession = /^Bearer discocan-session\./i.test(authorization ?? '');
  const identity = isSession ? await readSession(authorization) : undefined;
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
