import {
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  type HttpBackend,
  type HttpEvent,
  type HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { Kind, type DocumentNode } from 'graphql';
import { defer, finalize, mergeMap, NEVER, type Observable, of, throwError, timer } from 'rxjs';

// Storybook-only GraphQL transport. Real feature services and their Apollo clients run unchanged;
// only HttpClient's backend answers from deterministic in-memory fixtures.

/** Apollo normalizes by `__typename`; fixture results may add it at every object level. */
export type WithTypename<T> = T extends readonly (infer Item)[]
  ? readonly WithTypename<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: WithTypename<T[Key]> } & { readonly __typename?: string }
    : T;

/** How a story makes one operation fail instead of answering from fixtures. */
export type FixtureFailure = 'network' | 'graphql' | 'pending';

export interface FixtureScenario {
  /** Simulated server latency for every answered operation. */
  readonly latencyMs?: number;
  /** Operation name → forced outcome. */
  readonly failures?: Readonly<Record<string, FixtureFailure>>;
}

/** Thrown by a handler to answer with a GraphQL error, like a resolver validation failure. */
export class FixtureGraphqlError extends Error {
  constructor(
    message: string,
    readonly extensions: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}

/** Runtime-checked access to operation variables and the request's Branch scope. */
export class FixtureVariables {
  constructor(
    private readonly values: Readonly<Record<string, unknown>>,
    readonly branchId: string | null = null,
  ) {}

  string(name: string): string | null {
    const value = this.values[name];
    return typeof value === 'string' ? value : null;
  }

  requiredString(name: string): string {
    const value = this.string(name);
    if (value === null) throw new FixtureGraphqlError(`Variable "${name}" must be a string.`);
    return value;
  }

  int(name: string, fallback: number): number {
    const value = this.values[name];
    return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
  }

  strings(name: string): readonly string[] | null {
    const value = this.values[name];
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
  }

  object(name: string): FixtureVariables {
    const value = this.values[name];
    return new FixtureVariables(isRecord(value) ? value : {}, this.branchId);
  }

  has(name: string): boolean {
    return name in this.values;
  }
}

type Handler = (variables: FixtureVariables) => unknown;

const handlers = new Map<string, Handler>();
let scenario: Required<FixtureScenario> = { latencyMs: 0, failures: {} };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function operationName(document: DocumentNode): string {
  for (const definition of document.definitions)
    if (definition.kind === Kind.OPERATION_DEFINITION && definition.name)
      return definition.name.value;
  throw new Error('Fixture documents must be named operations.');
}

/** Registers the answer for one generated operation document. */
export function graphqlFixture<Result, Variables>(
  document: TypedDocumentNode<Result, Variables>,
  handler: (variables: FixtureVariables) => WithTypename<Result>,
): void {
  handlers.set(operationName(document), handler);
}

let inFlight = 0;

// Exposes answered requests in flight, so visual checks can wait until fixture data has settled.
// Requests a story deliberately leaves pending are not counted.
function track(change: number): void {
  inFlight += change;
  const root = document.documentElement;
  root.dataset['fixtureInFlight'] = String(inFlight);
  root.dataset['fixtureActivity'] = String(performance.now());
}

/** Applies a story's scenario; called before every story renders. */
export function useFixtureScenario(next: FixtureScenario | undefined): void {
  scenario = { latencyMs: next?.latencyMs ?? 0, failures: next?.failures ?? {} };
  inFlight = 0;
  track(0);
}

@Injectable()
export class FixtureHttpBackend implements HttpBackend {
  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const body = isRecord(request.body) ? request.body : {};
    const name = typeof body['operationName'] === 'string' ? body['operationName'] : 'Unnamed';
    const variables = new FixtureVariables(
      isRecord(body['variables']) ? body['variables'] : {},
      request.headers.get('x-branch-id'),
    );
    // A fixed request ID keeps error messages identical between runs and screenshots.
    const requestId = `fixture-${name}`;
    const url = request.urlWithParams;
    const failure = scenario.failures[name];
    if (failure === 'pending') return NEVER;
    return defer(() => {
      track(1);
      return this.answer(name, variables, failure, requestId, url).pipe(
        finalize(() => {
          track(-1);
        }),
      );
    });
  }

  private answer(
    name: string,
    variables: FixtureVariables,
    failure: FixtureFailure | undefined,
    requestId: string,
    url: string,
  ): Observable<HttpEvent<unknown>> {
    const headers = new HttpHeaders({ 'x-request-id': requestId });
    return timer(scenario.latencyMs).pipe(
      mergeMap(() => {
        if (failure === 'network')
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 503,
                statusText: 'Service Unavailable',
                headers,
                url,
              }),
          );
        if (failure === 'graphql')
          return of(graphqlErrorResponse('The demo service is unavailable.', {}, requestId, url));
        const handler = handlers.get(name);
        if (!handler)
          return of(
            graphqlErrorResponse(`No Storybook fixture answers ${name}.`, {}, requestId, url),
          );
        try {
          return of(
            new HttpResponse({ status: 200, body: { data: handler(variables) }, headers, url }),
          );
        } catch (error) {
          if (error instanceof FixtureGraphqlError)
            return of(graphqlErrorResponse(error.message, error.extensions, requestId, url));
          throw error;
        }
      }),
    );
  }
}

function graphqlErrorResponse(
  message: string,
  extensions: Readonly<Record<string, unknown>>,
  requestId: string,
  url: string,
): HttpResponse<unknown> {
  return new HttpResponse({
    status: 200,
    body: { data: null, errors: [{ message, extensions: { ...extensions, requestId } }] },
    headers: new HttpHeaders({ 'x-request-id': requestId }),
    url,
  });
}
