import { readDemoTenant } from './demo-auth.js';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RequestContext {
  requestId: string;
  tenantId: string | undefined;
  branchId: string | undefined;
  authorization: string | undefined;
  branchChecks: Map<string, Promise<void>>;
}

export function createRequestContext({
  req,
  res,
}: {
  req: IncomingMessage;
  res: ServerResponse;
}): RequestContext {
  const supplied = req.headers['x-request-id'];
  const requestId =
    typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
      ? supplied
      : randomUUID();
  const header = req.headers['x-branch-id'];
  const authorization = req.headers.authorization;
  const tenantId = readDemoTenant(authorization);
  res.setHeader('x-request-id', requestId);
  return {
    requestId,
    tenantId,
    branchId: typeof header === 'string' ? header : undefined,
    authorization,
    branchChecks: new Map(),
  };
}
