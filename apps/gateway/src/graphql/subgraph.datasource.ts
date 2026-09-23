import { RemoteGraphQLDataSource, type GraphQLDataSourceProcessOptions } from '@apollo/gateway';
import { GraphQLError } from 'graphql';
import type { RequestContext } from './request-context.js';

export class SubgraphDataSource extends RemoteGraphQLDataSource<RequestContext> {
  override willSendRequest(options: GraphQLDataSourceProcessOptions<RequestContext>): void {
    if (!('incomingRequestContext' in options)) return;
    const { request, context } = options;
    if (!request.http) return;
    request.http.headers.set('x-request-id', context.requestId);
    if (context.storeId !== undefined) request.http.headers.set('x-store-id', context.storeId);
  }

  override didEncounterError(): never {
    throw new GraphQLError('A required service is unavailable; try again later', {
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    });
  }
}
