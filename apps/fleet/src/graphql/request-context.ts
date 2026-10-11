import { readDemoTenant } from './demo-auth.js';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RequestContext {
  requestId: string;
  tenantId: string | undefined;
  authorization: string | undefined;
  storeId: string | undefined;
  storeChecks: Map<string, Promise<void>>;
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
  const header = req.headers['x-store-id'];
  const authorization = req.headers.authorization;
  const tenantId = readDemoTenant(authorization);
  res.setHeader('x-request-id', requestId);
  return {
    requestId,
    tenantId,
    authorization,
    storeId: typeof header === 'string' ? header : undefined,
    storeChecks: new Map(),
  };
}
