import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminControlCenterReturnToDiscoCanDocument,
  AdminControlCenterSmsDevicesDocument,
} from '../../../generated/graphql/operations';
import { ControlCenterApi } from '../control-center/control-center-api';

@Injectable()
export class ErmDeviceApi {
  private readonly controlCenter = inject(ControlCenterApi);

  watchSmsDevice(deviceId: string) {
    return this.controlCenter.client().watchQuery({
      query: AdminControlCenterSmsDevicesDocument,
      variables: { ids: deviceId ? [deviceId] : undefined },
      fetchPolicy: 'network-only',
    });
  }

  async returnToDiscoCan(deviceId: string) {
    const result = await firstValueFrom(
      this.controlCenter.client().mutate({
        mutation: AdminControlCenterReturnToDiscoCanDocument,
        variables: { deviceId },
      }),
    );
    if (!result.data?.returnErmDeviceToDiscoCan) {
      throw new Error('Missing returnErmDeviceToDiscoCan result.');
    }
    return result.data.returnErmDeviceToDiscoCan;
  }
}
