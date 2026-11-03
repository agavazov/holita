import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readDemoTenant } from '../auth/demo-auth.js';

export interface RequestContext {
  requestId: string;
  tenantId: string | undefined;
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
  res.setHeader('x-request-id', requestId);
  return { requestId, tenantId: readDemoTenant(req.headers.authorization) };
}
