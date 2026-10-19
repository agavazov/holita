import { readAdminConfig, readGraphqlUrl, readLocalAdminConfig } from './admin-config';

describe('public Angular configuration', () => {
  it('retains the configured Gateway endpoint and Fleet availability', () => {
    expect(
      readAdminConfig({
        graphqlUrl: 'https://gateway.example/graphql',
        fleetEnabled: false,
        primeUiLicense: ' configured-key ',
      }),
    ).toEqual({
      graphqlUrl: 'https://gateway.example/graphql',
      fleetEnabled: false,
      primeUiLicense: 'configured-key',
    });
    expect(() => readAdminConfig({ fleetEnabled: false })).toThrow(
      'config.json requires graphqlUrl.',
    );
  });
  it('accepts explicit Fleet availability and rejects non-boolean flags', () => {
    for (const fleetEnabled of [true, false]) {
      expect(readAdminConfig({ graphqlUrl: '/graphql', fleetEnabled })).toEqual({
        graphqlUrl: '/graphql',
        fleetEnabled,
      });
    }
    for (const fleetEnabled of ['false', null, 0]) {
      expect(() => readAdminConfig({ graphqlUrl: '/graphql', fleetEnabled })).toThrow(
        'fleetEnabled must be a boolean.',
      );
    }
  });
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
  it('reads only a trimmed PrimeUI license from the ignored local configuration', () => {
    expect(readLocalAdminConfig({})).toEqual({});
    expect(readLocalAdminConfig({ primeUiLicense: ' local-key ' })).toEqual({
      primeUiLicense: 'local-key',
    });
    expect(readLocalAdminConfig({ primeUiLicense: '  ' })).toEqual({});
    expect(() => readLocalAdminConfig({ primeUiLicense: 42 })).toThrow(
      'primeUiLicense must be a string.',
    );
    expect(() => readLocalAdminConfig({ graphqlUrl: '/graphql' })).toThrow(
      'config.local.json does not support "graphqlUrl".',
    );
    for (const value of [null, 'key', ['key']]) {
      expect(() => readLocalAdminConfig(value)).toThrow('config.local.json must be an object.');
    }
  });
  it('accepts a same-origin proxy path and a public HTTP gateway URL', () => {
    expect(readGraphqlUrl({ graphqlUrl: '/graphql' })).toBe('/graphql');
    expect(readGraphqlUrl({ graphqlUrl: 'http://127.0.0.1:11010/graphql' })).toBe(
      'http://127.0.0.1:11010/graphql',
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
