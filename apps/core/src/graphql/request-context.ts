import { readDemoTenant } from '../auth/demo-auth.js';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthService } from '../auth/auth.service.js';

export interface RequestContext {
  requestId: string;
  tenantId: string | undefined;
  userId: string | undefined;
  sessionId: string | undefined;
  branchId: string | undefined;
  authorization: string | undefined;
}

export async function createRequestContext(
  {
    req,
    res,
  }: {
    req: IncomingMessage;
    res: ServerResponse;
  },
  auth: AuthService,
): Promise<RequestContext> {
  const supplied = req.headers['x-request-id'];
  const requestId =
    typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
      ? supplied
      : randomUUID();
  const header = req.headers['x-branch-id'];
  const authorization = req.headers.authorization;
  res.setHeader('x-request-id', requestId);
  const identity = await auth.verifyAuthorization(authorization);
  return {
    requestId,
    tenantId: identity?.tenantId ?? readDemoTenant(authorization),
    userId: identity?.userId,
    sessionId: identity?.sessionId,
    branchId: typeof header === 'string' ? header : undefined,
    authorization,
  };
}
