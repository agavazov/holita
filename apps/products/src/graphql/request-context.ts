import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RequestContext {
  requestId: string;
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
  res.setHeader('x-request-id', requestId);
  return {
    requestId,
    storeId: typeof header === 'string' ? header : undefined,
    storeChecks: new Map(),
  };
}
