import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { deviceFieldErrors, deviceInput } from './device-mapping';

describe('Device editor mapping', () => {
  it('preserves IMEI zeros and real catalog values and explicitly clears optional fields', () => {
    expect(
      deviceInput({
        imei: ' 000000000000001 ',
        model: 'STARLINK_SCOUT',
        vehicleId: null,
        simIccid: '',
        notes: '',
        options: ['CELLULAR_4G', 'IRF'],
        firmwareVersion: '',
        simPhoneNumber: '',
        installedAt: '',
      }),
    ).toEqual({
      imei: '000000000000001',
      model: 'STARLINK_SCOUT',
      vehicleId: null,
      simIccid: null,
      notes: null,
      options: ['CELLULAR_4G', 'IRF'],
      firmwareVersion: null,
      simPhoneNumber: null,
      installedAt: null,
    });
    expect(
      deviceInput({ imei: '000000000000001', model: '', vehicleId: null, simIccid: '', notes: '' })
        .model,
    ).toBeNull();
    expect(() =>
      deviceInput({
        imei: '000000000000001',
        model: 'FMB920',
        vehicleId: null,
        simIccid: '',
        notes: '',
      }),
    ).toThrow('Unsupported device model');
  });
  it('maps server option and assignment failures to their actual form fields', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid fields',
          extensions: {
            fieldErrors: [
              { path: 'options', message: 'Choose compatible options.' },
              { path: 'vehicleId', message: 'Choose a vehicle in this branch.' },
              { path: 'unknown', message: 'Ignore.' },
            ],
          },
        },
      ],
    });
    expect(deviceFieldErrors(error)).toEqual({
      options: 'Choose compatible options.',
      vehicleId: 'Choose a vehicle in this branch.',
    });
  });
});
