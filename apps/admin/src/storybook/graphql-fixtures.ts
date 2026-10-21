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

/** How a story makes an operation fail instead of answering from fixtures. */
export type FixtureFailure =
  | 'network'
  | 'graphql'
  | 'pending'
  | 'not-found'
  | 'conflict'
  | 'unavailable'
  | 'bad-input'
  | 'network-after-first';

export const fixtureFailures: readonly FixtureFailure[] = [
  'network',
  'graphql',
  'pending',
  'not-found',
  'conflict',
  'unavailable',
  'bad-input',
  'network-after-first',
];

export interface FixtureScenario {
  /** Simulated server latency for every answered operation. */
  readonly latencyMs?: number;
  /** Keys: an operation name (every call fails) or `<OperationName>:<id>` (only calls whose
   * `id` variable equals <id> fail); the record-specific key wins. */
  readonly failures?: Readonly<Record<string, FixtureFailure>>;
}

/** The backend error codes (backend error model). */
export type FixtureErrorCode =
  'BAD_USER_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'SERVICE_UNAVAILABLE' | 'UNAUTHENTICATED';

/** Thrown by a handler to answer with a GraphQL error, like a resolver validation failure. */
export class FixtureGraphqlError extends Error {
  constructor(
    message: string,
    readonly extensions: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}

/** A GraphQL error with a backend code and optional `fieldErrors`, for handlers to throw. */
export function fixtureError(
  code: FixtureErrorCode,
  message: string,
  fieldErrors?: readonly {
    readonly path: string;
    readonly message: string;
    readonly code?: string;
  }[],
): FixtureGraphqlError {
  return new FixtureGraphqlError(message, { code, ...(fieldErrors ? { fieldErrors } : {}) });
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
    if (value === null) {
      throw new FixtureGraphqlError(`Variable "${name}" must be a string.`);
    }
    return value;
  }

  int(name: string, fallback: number): number {
    const value = this.values[name];
    return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
  }

  /** An integer, or `null` when absent or not an integer. */
  integer(name: string): number | null {
    const value = this.values[name];
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  }

  /** A finite number, or `null`. */
  number(name: string): number | null {
    const value = this.values[name];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  /** A boolean, or `null`. */
  boolean(name: string): boolean | null {
    const value = this.values[name];
    return typeof value === 'boolean' ? value : null;
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

  /** Present and `null`: update inputs use it to clear a field. */
  isExplicitNull(name: string): boolean {
    return name in this.values && this.values[name] === null;
  }
}

type Handler = (variables: FixtureVariables) => unknown;

const handlers = new Map<string, Handler>();
const calls = new Map<string, number>();
let scenario: Required<FixtureScenario> = { latencyMs: 0, failures: {} };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function operationName(document: DocumentNode): string {
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION && definition.name) {
      return definition.name.value;
    }
  }
  throw new Error('Fixture documents must be named operations.');
}

/** Registers the answer for one generated operation document. */
export function graphqlFixture<Result, Variables>(
  document: TypedDocumentNode<Result, Variables>,
  handler: (variables: FixtureVariables) => WithTypename<Result>,
): void {
  handlers.set(operationName(document), handler);
}

/** Operation names with a registered handler (fixture coverage specs). */
export function registeredOperations(): readonly string[] {
  return [...handlers.keys()].sort();
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
  calls.clear();
  inFlight = 0;
  track(0);
}

/** The forced outcome of one call: a record-specific key wins over the operation name. */
export function failureFor(name: string, variables: FixtureVariables): FixtureFailure | undefined {
  const id = variables.string('id');
  const key = id !== null && `${name}:${id}` in scenario.failures ? `${name}:${id}` : name;
  const failure = scenario.failures[key];
  if (failure !== 'network-after-first') {
    return failure;
  }
  const count = (calls.get(key) ?? 0) + 1;
  calls.set(key, count);
  return count > 1 ? 'network' : undefined;
}

const failureErrors: Partial<Record<FixtureFailure, FixtureGraphqlError>> = {
  graphql: new FixtureGraphqlError('The demo service is unavailable.'),
  'not-found': fixtureError('NOT_FOUND', 'The record was not found.'),
  conflict: fixtureError('CONFLICT', 'The record changed meanwhile.'),
  unavailable: fixtureError('SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.'),
  'bad-input': fixtureError('BAD_USER_INPUT', 'The input is not valid.'),
};

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
    const failure = failureFor(name, variables);
    if (failure === 'pending') {
      return NEVER;
    }
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
        if (failure === 'network') {
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 503,
                statusText: 'Service Unavailable',
                headers,
                url,
              }),
          );
        }
        const forced = failure ? failureErrors[failure] : undefined;
        if (forced) {
          return of(graphqlErrorResponse(forced.message, forced.extensions, requestId, url));
        }
        const handler = handlers.get(name);
        if (!handler) {
          return of(
            graphqlErrorResponse(`No Storybook fixture answers ${name}.`, {}, requestId, url),
          );
        }
        try {
          return of(
            new HttpResponse({ status: 200, body: { data: handler(variables) }, headers, url }),
          );
        } catch (error) {
          if (error instanceof FixtureGraphqlError) {
            return of(graphqlErrorResponse(error.message, error.extensions, requestId, url));
          }
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
