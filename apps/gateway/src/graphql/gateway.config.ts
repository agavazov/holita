import { readFileSync } from 'node:fs';
import type { ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { formatGraphqlError, graphqlDiagnostics } from './errors.js';
import { createRequestContext } from './request-context.js';
import { SubgraphDataSource } from './subgraph.datasource.js';

function subgraphUrl(name: string, defaultUrl: string | undefined): string {
  const configured = {
    core: process.env.CORE_GRAPHQL_URL,
    products: process.env.PRODUCTS_GRAPHQL_URL,
    reference: process.env.REFERENCE_GRAPHQL_URL,
  }[name];
  const value = configured ?? defaultUrl;
  if (!value) throw new Error(`No GraphQL URL configured for ${name}`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid GraphQL URL for ${name}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error(`Invalid GraphQL URL for ${name}`);
  return url.toString();
}

export function gatewayConfig(): ApolloGatewayDriverConfig {
  // The local gateway does not need Apollo's anonymous metrics or cloud metadata probes.
  process.env.APOLLO_TELEMETRY_DISABLED = 'true';
  return {
    server: {
      path: '/graphql',
      context: createRequestContext,
      includeStacktraceInErrorResponses: false,
      autoTransformHttpErrors: false,
      formatError: formatGraphqlError,
      plugins: [graphqlDiagnostics],
    },
    gateway: {
      supergraphSdl: readFileSync(
        new URL('../generated/graphql/supergraph.graphql', import.meta.url),
        'utf8',
      ),
      buildService: ({ name, url }) =>
        new SubgraphDataSource({
          url: subgraphUrl(name, url),
          fetcher: (target, options) =>
            fetch(target, {
              method: options?.method ?? 'POST',
              headers: options?.headers ?? {},
              ...(options?.body === undefined ? {} : { body: options.body.toString() }),
              signal: AbortSignal.timeout(5000),
            }),
        }),
    },
  };
}
