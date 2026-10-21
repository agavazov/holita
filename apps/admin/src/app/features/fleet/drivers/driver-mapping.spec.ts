import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { AdminDriverDetailsFragment } from '../../../../generated/graphql/operations';
import { driverDetails, driverFieldErrors, driverInput, driverRow } from './driver-mapping';

const driver: AdminDriverDetailsFragment = {
  id: '20000000-0000-4000-8000-000000000001',
  branchId: '10000000-0000-4000-8000-000000000001',
  firstName: 'Elena',
  lastName: 'Petrova',
  employeeNumber: null,
  identificationKey: null,
  phone: null,
  email: null,
  licenseNumber: null,
  licenseCategories: ['B', 'CE'],
  licenseExpiresOn: '2028-02-29',
  tachographCardNumber: 'BG1234',
  tachographCardExpiresOn: null,
  status: 'ACTIVE',
  notes: 'First line\nSecond line',
  vehicles: [
    {
      id: 'v1',
      licensePlate: 'CB 1001 AX',
      fleetNumber: null,
      vehicleType: null,
      status: 'ACTIVE',
    },
    {
      id: 'v2',
      licensePlate: 'PB 2002 KM',
      fleetNumber: null,
      vehicleType: null,
      status: 'ACTIVE',
    },
  ],
  documentStatus: 'VALID',
  distance30dKm: 0,
  tripCount30d: 0,
  drivingScore30d: 0,
  maneuversPer100Km30d: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Driver generated contract mapping', () => {
  it('preserves zero scores, all assignments, notes and absent employee identity', () => {
    expect(driverRow(driver)).toMatchObject({
      id: driver.id,
      name: 'Elena Petrova',
      employeeNo: '',
      vehiclePlate: 'CB 1001 AX, PB 2002 KM',
      vehicles: [
        { id: 'v1', plate: 'CB 1001 AX' },
        { id: 'v2', plate: 'PB 2002 KM' },
      ],
      score: 0,
      trips30d: 0,
      distance30dKm: 0,
      notes: 'First line\nSecond line',
    });
    expect(driverDetails({ ...driver, drivingScore30d: null, vehicles: [] })).toMatchObject({
      score: null,
      vehiclePlate: null,
      vehicles: [],
      employeeNo: '',
    });
  });

  it('normalizes full submissions and explicitly clears optional fields without inventing identifiers', () => {
    expect(
      driverInput({
        ...driverDetails(driver),
        firstName: ' Elena ',
        lastName: ' Petrova ',
        employeeNo: ' ',
        identificationKey: ' ',
        phone: '',
        email: '',
        licenseNumber: '',
        licenseCategories: [],
        licenseExpiresOn: null,
        tachographCardNumber: '',
        tachoCardExpiresOn: null,
        notes: '\n ',
      }),
    ).toEqual({
      firstName: 'Elena',
      lastName: 'Petrova',
      employeeNumber: null,
      identificationKey: null,
      phone: null,
      email: null,
      status: 'ACTIVE',
      licenseNumber: null,
      licenseCategories: [],
      licenseExpiresOn: null,
      tachographCardNumber: null,
      tachographCardExpiresOn: null,
      notes: null,
    });
  });

  it('maps server employee and tachograph paths back to the actual form controls', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid Driver',
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [
              { path: 'employeeNumber', message: 'Duplicate employee number.' },
              { path: 'tachographCardExpiresOn', message: 'Invalid expiry.' },
              { path: 'status', message: 'Assigned driver.' },
              { path: 'employeeNo', message: 'Not a server field.' },
            ],
          },
        },
      ],
    });
    expect(driverFieldErrors(error)).toEqual({
      employeeNo: 'The value is not valid.',
      tachoCardExpiresOn: 'The value is not valid.',
      status: 'The value is not valid.',
    });
  });
});
