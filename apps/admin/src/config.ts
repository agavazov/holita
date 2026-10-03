export type DataSource = 'mock' | 'graphql';

export const prototypeGraphqlPath = '/__prototype/graphql';

export function readDataSource(value: unknown): DataSource {
  if (value === undefined || value === 'graphql') return 'graphql';
  if (value === 'mock') return 'mock';
  throw new Error('VITE_DATA_SOURCE must be mock or graphql.');
}

export function graphqlEndpoint(dataSource: DataSource, gatewayUrl?: string) {
  return dataSource === 'mock'
    ? new URL(prototypeGraphqlPath, window.location.origin).href
    : (gatewayUrl ?? 'http://127.0.0.1:11080/graphql');
}
