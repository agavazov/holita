import type {
  AdminDeviceConfigurationOperationFragment,
  AdminKarmaCarQuery,
  AdminKarmaEdataQuery,
} from '../../../../generated/graphql/operations';

export type DeviceConfigurationState = 'loading' | 'ready' | 'not-found' | 'invalid-id' | 'error';
export type DeviceConfigurationTarget = Pick<
  NonNullable<AdminKarmaCarQuery['karmaCar']>,
  'id' | 'deviceId' | 'carNumber'
>;
export type DeviceConfigurationOperation = AdminDeviceConfigurationOperationFragment;

export interface DeviceParameterMeasurements {
  readonly parameterId: number;
  readonly fromUtc: string;
  readonly toUtc: string;
  readonly state: 'loading' | 'ready' | 'error';
  readonly items: AdminKarmaEdataQuery['karmaEdata']['items'];
}

export function deviceReadPending(operation: DeviceConfigurationOperation): boolean {
  return (
    operation.status === 'QUEUED' ||
    operation.status === 'SUBMITTING' ||
    operation.status === 'WAITING' ||
    operation.status === 'UNKNOWN'
  );
}
