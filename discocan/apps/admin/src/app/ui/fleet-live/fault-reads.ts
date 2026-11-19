import type { ApolloBase } from 'apollo-angular';
import { from, map, mergeMap, toArray } from 'rxjs';
import { AdminDeviceFaultReadsDocument } from '../../../generated/graphql/operations';

// Fleet serves each Device's latest command requests through its single-device query.
export function readFaultHistories(apollo: ApolloBase, deviceIds: readonly string[]) {
  return from(new Set(deviceIds)).pipe(
    mergeMap(
      (id) =>
        apollo
          .query({
            query: AdminDeviceFaultReadsDocument,
            variables: { id },
            fetchPolicy: 'network-only',
          })
          .pipe(
            map(({ data }) => {
              if (!data) {
                throw new Error('The device fault reads are unavailable.');
              }
              return [id, data.fleetDevice.commandRequests] as const;
            }),
          ),
      6,
    ),
    toArray(),
    map((rows) => new Map(rows)),
  );
}
