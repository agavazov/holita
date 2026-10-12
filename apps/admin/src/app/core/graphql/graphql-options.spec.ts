import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import { ServerError } from '@apollo/client/errors';
import { HttpLink } from 'apollo-angular/http';
import { appConfig } from '../../app.config';
import { AdminStoresDocument } from '../../../generated/graphql/operations';
import { graphqlOptions } from './graphql-options';
import { requestError } from './request-error';

const fallback = 'Could not reach the gateway.';

describe('GraphQL transport diagnostics', () => {
  let http: HttpTestingController;
  let client: ApolloClient;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = new ApolloClient(graphqlOptions(TestBed.inject(HttpLink), '/graphql'));
  });
  afterEach(() => {
    client.stop();
    http.verify({ ignoreCancelled: true });
    vi.useRealTimers();
  });

  it('retains independent request IDs for concurrent network and HTTP failures', async () => {
    const english = client.query({
      query: AdminStoresDocument,
      context: { language: 'en', queryDeduplication: false },
    });
    const englishFailure = english.catch((error: unknown) => error);
    const englishRequest = http.expectOne('/graphql');
    const englishId = englishRequest.request.headers.get('x-request-id');
    const bulgarian = client.query({
      query: AdminStoresDocument,
      context: { language: 'bg', queryDeduplication: false },
    });
    const bulgarianFailure = bulgarian.catch((error: unknown) => error);
    const bulgarianRequest = http.expectOne('/graphql');
    const bulgarianId = bulgarianRequest.request.headers.get('x-request-id');
    if (!englishId || !bulgarianId) throw new Error('Missing request diagnostics headers.');
    expect(englishId).not.toBe(bulgarianId);
    bulgarianRequest.flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    const httpError = await bulgarianFailure;
    expect(ServerError.is(httpError)).toBe(true);
    expect(requestError(httpError, fallback)).toBe(`${fallback} (${bulgarianId})`);
    englishRequest.error(new ProgressEvent('error'));
    expect(requestError(await englishFailure, fallback)).toBe(`${fallback} (${englishId})`);
  });

  it('uses the Gateway response request ID for an HTTP failure when supplied', async () => {
    const failure = client.query({ query: AdminStoresDocument }).catch((error: unknown) => error);
    http.expectOne('/graphql').flush('Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'x-request-id': 'gateway-diagnostic-id' },
    });
    expect(requestError(await failure, fallback)).toBe(`${fallback} (gateway-diagnostic-id)`);
  });

  it('preserves GraphQL diagnostics instead of replacing the server message', async () => {
    const failure = client.query({ query: AdminStoresDocument }).catch((error: unknown) => error);
    http.expectOne('/graphql').flush({
      errors: [{ message: 'Discovery unavailable', extensions: { requestId: 'graphql-id' } }],
    });
    expect(requestError(await failure, fallback)).toBe('Discovery unavailable (graphql-id)');
  });

  it('retains the initiating request ID when the actual 10-second HTTP deadline expires', async () => {
    client.stop();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [...appConfig({ graphqlUrl: '/graphql' }).providers, provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = new ApolloClient(graphqlOptions(TestBed.inject(HttpLink), '/graphql'));
    vi.useFakeTimers();
    const failure = client.query({ query: AdminStoresDocument }).catch((error: unknown) => error);
    const request = http.expectOne('/graphql');
    const requestId = request.request.headers.get('x-request-id');
    if (!requestId) throw new Error('Missing request diagnostics header.');
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await failure;
    expect(error).toHaveProperty('name', 'TimeoutError');
    expect(request.cancelled).toBe(true);
    expect(requestError(error, fallback)).toBe(`${fallback} (${requestId})`);
  });
});
