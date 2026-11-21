import type { ApolloBase } from 'apollo-angular';
import { map, of } from 'rxjs';
import { AdminDeviceFaultReadsDocument } from '../../../generated/graphql/operations';
import type { FleetFaultRead } from './fault-wording';

export function readFaultHistories(apollo: ApolloBase, deviceIds: readonly string[]) {
  if (deviceIds.length === 0) {
    return of(new Map<string, FleetFaultRead[]>());
  }
  return apollo
    .query({
      query: AdminDeviceFaultReadsDocument,
      variables: { deviceIds: [...new Set(deviceIds)] },
      fetchPolicy: 'network-only',
    })
    .pipe(
      map(({ data }) => {
        if (!data) {
          throw new Error('The device fault reads are unavailable.');
        }
        const histories = new Map<string, FleetFaultRead[]>();
        for (const read of data.fleetDeviceFaultReads) {
          const history = histories.get(read.deviceId);
          if (history) {
            history.push(read);
          } else {
            histories.set(read.deviceId, [read]);
          }
        }
        return histories;
      }),
    );
}

export function faultReadDevice<T extends { type: string }>(
  devices: readonly (T | null | undefined)[],
) {
  return devices.find((device) => device?.type === 'ERM');
}
