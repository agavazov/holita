import { readAdminConfig, readGraphqlUrl } from './admin-config';

describe('public Angular configuration', () => {
  it('accepts an optional public PrimeUI license and leaves an omitted or empty key unset', () => {
    expect(readAdminConfig({ graphqlUrl: '/graphql' })).toEqual({ graphqlUrl: '/graphql' });
    expect(readAdminConfig({ graphqlUrl: '/graphql', primeUiLicense: ' ' })).toEqual({
      graphqlUrl: '/graphql',
    });
    expect(readAdminConfig({ graphqlUrl: '/graphql', primeUiLicense: ' configured-key ' })).toEqual(
      { graphqlUrl: '/graphql', primeUiLicense: 'configured-key' },
    );
    expect(() => readAdminConfig({ graphqlUrl: '/graphql', primeUiLicense: 42 })).toThrow(
      'primeUiLicense must be a string.',
    );
  });
  it('accepts a same-origin proxy path and a public HTTP gateway URL', () => {
    expect(readGraphqlUrl({ graphqlUrl: '/graphql' })).toBe('/graphql');
    expect(readGraphqlUrl({ graphqlUrl: 'http://127.0.0.1:11080/graphql' })).toBe(
      'http://127.0.0.1:11080/graphql',
    );
  });

  it.each([
    null,
    {},
    { graphqlUrl: '' },
    { graphqlUrl: 'javascript:alert(1)' },
    { graphqlUrl: 'https://user:password@example.com/graphql' },
    { graphqlUrl: 'https://example.com/graphql#fragment' },
  ])('rejects an invalid endpoint: %j', (value) => {
    expect(() => readGraphqlUrl(value)).toThrow();
  });
});
