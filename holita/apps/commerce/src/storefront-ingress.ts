import { Injectable, NotFoundException, type OnApplicationShutdown } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { getOperationAST, Kind, OperationTypeNode, parse, type SelectionSetNode } from 'graphql';
import { request as forward, type IncomingMessage, type ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { StorefrontService } from './storefront.service.js';

function signInFields(body: Buffer): number {
  try {
    const payload: unknown = JSON.parse(body.toString('utf8'));
    if (!payload || typeof payload !== 'object' || !('query' in payload)) {
      return 0;
    }
    const query = payload.query;
    if (typeof query !== 'string') {
      return 0;
    }
    const operationName =
      'operationName' in payload && typeof payload.operationName === 'string'
        ? payload.operationName
        : undefined;
    const document = parse(query, { maxTokens: 15_000, noLocation: true });
    const operation = getOperationAST(document, operationName);
    if (operation?.operation !== OperationTypeNode.MUTATION) {
      return 0;
    }

    const fragments = new Map<string, SelectionSetNode>();
    for (const definition of document.definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragments.set(definition.name.value, definition.selectionSet);
      }
    }
    const pending = [operation.selectionSet];
    const fields = new Set<string>();
    for (const set of pending) {
      for (const selection of set.selections) {
        if (selection.kind === Kind.INLINE_FRAGMENT) {
          pending.push(selection.selectionSet);
        } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
          const name = selection.name.value;
          const fragment = fragments.get(name);
          if (fragment) {
            fragments.delete(name);
            pending.push(fragment);
          }
        } else if (selection.name.value === 'signInShopper') {
          fields.add(selection.alias?.value ?? selection.name.value);
        }
      }
    }
    return fields.size;
  } catch {
    // Apollo Router reports malformed GraphQL requests.
    return 0;
  }
}

type StorefrontRequest = IncomingMessage & { body?: unknown };

@Injectable()
export class StorefrontIngress implements OnApplicationShutdown {
  private readonly http = new ExpressAdapter();
  private readonly routerPort = Number(process.env.STOREFRONT_ROUTER_PORT ?? '12031');
  private readonly origin = process.env.STOREFRONT_ORIGIN ?? 'http://127.0.0.1:12020';

  constructor(private readonly storefront: StorefrontService) {}

  listen(): Promise<void> {
    this.http.initHttpServer({ forceCloseConnections: true });
    // Match the Router's request body limit before parsing the GraphQL operation.
    this.http.useBodyParser('raw', false, { limit: 2_000_000, type: () => true });
    this.http.use((request: StorefrontRequest, response: ServerResponse) =>
      this.handle(request, response),
    );
    this.http.setErrorHandler(
      (
        error: unknown,
        request: StorefrontRequest,
        response: ServerResponse,
        next: (error: unknown) => void,
      ) => {
        if (response.headersSent) {
          next(error);
          return;
        }
        const status = error && typeof error === 'object' && 'status' in error ? error.status : 500;
        if (status === 400 || status === 413 || status === 415) {
          this.error(request, response, status, 'BAD_REQUEST', 'Invalid request body');
        } else {
          this.error(request, response, 503, 'SERVICE_UNAVAILABLE', 'Storefront is unavailable');
        }
      },
    );
    const server = this.http.getHttpServer();
    const port = Number(process.env.STOREFRONT_GRAPHQL_PORT ?? '12030');
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      this.http.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.http.close();
  }

  private async handle(request: StorefrontRequest, response: ServerResponse): Promise<void> {
    const body = Buffer.isBuffer(request.body) ? request.body : undefined;
    const count =
      body && request.method === 'POST' && request.url?.split('?', 1)[0] === '/graphql'
        ? signInFields(body)
        : 0;
    if (count) {
      const branchId = request.headers['x-branch-id'];
      try {
        if (
          !(await this.storefront.allowSignIn(
            typeof branchId === 'string' ? branchId : undefined,
            count,
          ))
        ) {
          this.error(request, response, 200, 'TOO_MANY_REQUESTS', 'Too many sign-in attempts');
          return;
        }
      } catch (error: unknown) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
        this.error(request, response, 200, 'NOT_FOUND', 'Shop not found');
        return;
      }
    }

    const headers = { ...request.headers };
    if (body) {
      // The body parser delivers decompressed bytes.
      delete headers['content-encoding'];
      delete headers['transfer-encoding'];
      headers['content-length'] = String(body.length);
    }
    const upstream = forward(
      {
        hostname: '127.0.0.1',
        port: this.routerPort,
        method: request.method,
        path: request.url,
        headers,
      },
      (result) => {
        response.writeHead(result.statusCode ?? 503, result.headers);
        void pipeline(result, response).catch(() => response.destroy());
      },
    );
    upstream.on('error', () => {
      if (response.headersSent) {
        response.destroy();
      } else {
        this.error(request, response, 503, 'SERVICE_UNAVAILABLE', 'Storefront is unavailable');
      }
    });
    response.on('close', () => {
      if (!response.writableFinished) {
        upstream.destroy();
      }
    });
    upstream.end(body);
  }

  private error(
    request: StorefrontRequest,
    response: ServerResponse,
    status: number,
    code: string,
    message: string,
  ): void {
    response.writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...(request.headers.origin === this.origin
        ? { 'access-control-allow-origin': this.origin, vary: 'Origin' }
        : {}),
    });
    response.end(JSON.stringify({ data: null, errors: [{ message, extensions: { code } }] }));
  }
}
