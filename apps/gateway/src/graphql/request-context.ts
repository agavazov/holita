import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RequestContext {
  requestId: string;
  authorization: string | undefined;
  storeId: string | undefined;
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
    authorization: req.headers.authorization,
    storeId: typeof header === 'string' ? header : undefined,
  };
}
