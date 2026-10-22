import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { AdminBranchesDocument } from '../../../generated/graphql/operations';
import { graphqlOptions } from './graphql-options';

const branchA = '7C9E6679-7425-40DE-944B-E07FC1F90AE7';
const branchB = '10000000-0000-4000-8000-000000000002';

describe('GraphQL client options', () => {
  it('graphqlOptions isolates every client to its captured session, Branch and cache', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const link = TestBed.inject(HttpLink);
    // Every client exists before the first request, so none can read another's captured values.
    const rows = [
      {
        client: 'Fleet client A',
        options: graphqlOptions(
          link,
          '/graphql',
          { branchId: branchA, language: 'en' },
          { tenantId: 'tenant-a', token: 'token-a' },
        ),
        language: 'bg',
        headers: {
          authorization: 'Bearer token-a',
          'x-branch-id': branchA.toLowerCase(),
          'accept-language': 'en',
        },
      },
      {
        client: 'Fleet client B',
        options: graphqlOptions(
          link,
          '/graphql',
          { branchId: branchB, language: 'bg' },
          { tenantId: 'tenant-b', token: 'token-b' },
        ),
        language: 'en',
        headers: {
          authorization: 'Bearer token-b',
          'x-branch-id': branchB,
          'accept-language': 'bg',
        },
      },
      {
        client: 'session-only client',
        options: graphqlOptions(link, '/graphql', undefined, {
          tenantId: 'tenant-a',
          token: 'token-a',
        }),
        language: 'en',
        headers: { authorization: 'Bearer token-a', 'x-branch-id': null, 'accept-language': 'en' },
      },
      {
        client: 'public client',
        options: graphqlOptions(link, '/graphql'),
        language: 'bg',
        headers: { authorization: null, 'x-branch-id': null, 'accept-language': 'bg' },
      },
    ];
    for (const { client: label, options, language, headers } of rows) {
      const client = new ApolloClient(options);
      // Earlier clients already cached this cache-first query; a separate cache still asks.
      const result = client.query({ query: AdminBranchesDocument, context: { language } });
      const request = http.expectOne('/graphql', `${label} request`);
      const sent = request.request.headers;
      expect(
        {
          authorization: sent.get('authorization'),
          'x-branch-id': sent.get('x-branch-id'),
          'accept-language': sent.get('accept-language'),
        },
        `${label} headers`,
      ).toEqual(headers);
      request.flush({ data: { branches: [] } });
      await result;
      client.stop();
    }
    expect(
      () => graphqlOptions(link, '/graphql', { branchId: 'not-a-uuid', language: 'en' }),
      'non-UUID Branch',
    ).toThrow('A UUID branch context is required.');
    http.verify();
  });
});
