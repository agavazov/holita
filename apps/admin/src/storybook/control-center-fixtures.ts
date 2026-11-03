import {
  AdminControlCenterSmsDevicesDocument,
  type AdminControlCenterSmsDevicesQuery,
} from '../generated/graphql/operations';
import { graphqlFixture, type WithTypename } from './graphql-fixtures';

type SmsDevice = WithTypename<AdminControlCenterSmsDevicesQuery['fleetDevices']['items'][number]>;

const smsDevices: readonly SmsDevice[] = [
  {
    __typename: 'FleetDevice',
    id: '61000000-0000-4000-8000-000000000001',
    imei: '001234567890123',
    simPhoneNumber: '+359888000001',
    smsPassword: 'password',
    vehicle: {
      __typename: 'FleetVehicleRef',
      id: '50000000-0000-4000-8000-000000000001',
      licensePlate: 'CB 1001 AX',
      fleetNumber: '12',
    },
  },
  {
    __typename: 'FleetDevice',
    id: '61000000-0000-4000-8000-000000000002',
    imei: '001234567890124',
    simPhoneNumber: '+359888000002',
    smsPassword: null,
    vehicle: {
      __typename: 'FleetVehicleRef',
      id: '50000000-0000-4000-8000-000000000002',
      licensePlate: 'CB 1002 AX',
      fleetNumber: null,
    },
  },
  {
    __typename: 'FleetDevice',
    id: '61000000-0000-4000-8000-000000000003',
    imei: '001234567890125',
    simPhoneNumber: null,
    smsPassword: null,
    vehicle: null,
  },
];

graphqlFixture(AdminControlCenterSmsDevicesDocument, () => ({
  fleetDevices: { __typename: 'FleetDevicePage', total: smsDevices.length, items: [...smsDevices] },
}));
