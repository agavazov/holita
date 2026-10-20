import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { AdminVehicleDetailsFragment } from '../../../../generated/graphql/operations';
import { vehicleFieldErrors, vehicleForm, vehicleInput, vehicleRow } from './vehicle-mapping';

const vehicle: AdminVehicleDetailsFragment = {
  id: '20000000-0000-4000-8000-000000000001',
  branchId: '10000000-0000-4000-8000-000000000001',
  licensePlate: 'CA1234AB',
  notes: 'First line\nSecond line',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  fleetNumber: 'T-04',
  vehicleType: 'TRACTOR',
  make: 'Volvo',
  model: 'FH',
  modelYear: 2024,
  vin: 'YV2RT40A1RB123456',
  fuelType: 'DIESEL',
  fuelTankCapacityL: 600,
  status: 'ACTIVE',
  groupId: '30000000-0000-4000-8000-000000000001',
  group: {
    id: '30000000-0000-4000-8000-000000000001',
    name: 'International',
    colorToken: 'C3',
  },
  currentDriverId: '40000000-0000-4000-8000-000000000001',
  currentDriver: {
    id: '40000000-0000-4000-8000-000000000001',
    firstName: 'Elena',
    lastName: 'Petrova',
    status: 'ACTIVE',
  },
  deviceCount: 2,
  openAlertCount: 0,
  state: {
    activity: 'PARKED',
    lastReportedAt: '2026-02-01T00:00:00.000Z',
    latitude: 0,
    longitude: 0,
    address: 'Sofia',
    speedKph: 0,
    headingDeg: 0,
    ignition: false,
    fuelLevelPct: 0,
    fuelStatus: 'STALE',
    externalVoltage: 0,
    backupBatteryVoltage: null,
    engineHours: null,
    coolantTempC: null,
    odometerKm: 0,
    odometerRecordedAt: '2026-02-01T00:00:00.000Z',
    odometerSource: 'MANUAL',
  },
};

describe('Vehicles contract mapping', () => {
  it('preserves server activity, fuel freshness, zero values and multiline notes in rows', () => {
    expect(vehicleRow(vehicle)).toEqual({
      id: vehicle.id,
      plate: 'CA1234AB',
      fleetNumber: 'T-04',
      type: 'TRACTOR',
      make: 'Volvo',
      model: 'FH',
      year: 2024,
      status: 'ACTIVE',
      activity: 'PARKED',
      lastReportedAt: '2026-02-01T00:00:00.000Z',
      location: 'Sofia',
      driverName: 'Elena Petrova',
      group: { name: 'International', slot: 'c3' },
      odometerKm: 0,
      fuelPct: 0,
      fuelStatus: 'STALE',
      openAlerts: 0,
      notes: 'First line\nSecond line',
    });
  });

  it('keeps absent telemetry and relations absent while supplying empty form text', () => {
    const empty: AdminVehicleDetailsFragment = {
      ...vehicle,
      fleetNumber: null,
      vehicleType: null,
      make: null,
      model: null,
      modelYear: null,
      vin: null,
      fuelType: null,
      fuelTankCapacityL: null,
      groupId: null,
      group: null,
      currentDriverId: null,
      currentDriver: null,
      notes: null,
      state: {
        ...vehicle.state,
        activity: 'NO_DEVICE',
        lastReportedAt: null,
        address: null,
        odometerKm: null,
        fuelLevelPct: null,
        fuelStatus: 'NO_DATA',
      },
    };
    expect(vehicleRow(empty)).toMatchObject({
      fleetNumber: null,
      type: null,
      make: '',
      model: '',
      year: null,
      activity: 'NO_DEVICE',
      lastReportedAt: null,
      location: null,
      driverName: null,
      group: null,
      odometerKm: null,
      fuelPct: null,
      fuelStatus: 'NO_DATA',
      notes: '',
    });
    expect(vehicleForm(empty)).toEqual({
      plate: 'CA1234AB',
      fleetNumber: '',
      vin: '',
      type: null,
      make: '',
      model: '',
      year: null,
      fuelType: null,
      tankL: null,
      status: 'ACTIVE',
      groupId: null,
      driverId: null,
      notes: '',
    });
  });

  it('hydrates every editable field from the detailed record', () => {
    expect(vehicleForm(vehicle)).toEqual({
      plate: 'CA1234AB',
      fleetNumber: 'T-04',
      vin: 'YV2RT40A1RB123456',
      type: 'TRACTOR',
      make: 'Volvo',
      model: 'FH',
      year: 2024,
      fuelType: 'DIESEL',
      tankL: 600,
      status: 'ACTIVE',
      groupId: vehicle.groupId,
      driverId: vehicle.currentDriverId,
      notes: 'First line\nSecond line',
    });
  });

  it('maps full form submissions to the generated create and update field names', () => {
    expect(
      vehicleInput({
        ...vehicleForm(vehicle),
        plate: ' CA1234AB ',
        fleetNumber: ' T-04 ',
        vin: ' yv2rt40a1rb123456 ',
        make: ' Volvo ',
        model: ' FH ',
        notes: ' First line\nSecond line ',
      }),
    ).toEqual({
      licensePlate: 'CA1234AB',
      fleetNumber: 'T-04',
      vin: 'YV2RT40A1RB123456',
      vehicleType: 'TRACTOR',
      make: 'Volvo',
      model: 'FH',
      modelYear: 2024,
      fuelType: 'DIESEL',
      fuelTankCapacityL: 600,
      status: 'ACTIVE',
      groupId: vehicle.groupId,
      currentDriverId: vehicle.currentDriverId,
      notes: 'First line\nSecond line',
    });
  });

  it('explicitly clears every optional field when the editor is emptied', () => {
    expect(
      vehicleInput({
        plate: ' CA1234AB ',
        fleetNumber: ' ',
        vin: '',
        type: null,
        make: '',
        model: '',
        year: null,
        fuelType: null,
        tankL: null,
        status: 'ACTIVE',
        groupId: null,
        driverId: null,
        notes: '\n ',
      }),
    ).toEqual({
      licensePlate: 'CA1234AB',
      fleetNumber: null,
      vin: null,
      vehicleType: null,
      make: null,
      model: null,
      modelYear: null,
      fuelType: null,
      fuelTankCapacityL: null,
      status: 'ACTIVE',
      groupId: null,
      currentDriverId: null,
      notes: null,
    });
  });

  it('maps generated server field paths back to their drawer controls', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid vehicle.',
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [
              { path: 'licensePlate', message: 'Plate required.' },
              { path: 'vehicleType', message: 'Unsupported type.' },
              { path: 'modelYear', message: 'Invalid year.' },
              { path: 'fuelTankCapacityL', message: 'Invalid tank.' },
              { path: 'currentDriverId', message: 'Inactive driver.' },
              { path: 'vin', message: 'Duplicate VIN.' },
              { path: 'plate', message: 'A view field is not a server path.' },
            ],
          },
        },
      ],
    });
    expect(vehicleFieldErrors(error)).toEqual({
      plate: 'Plate required.',
      type: 'Unsupported type.',
      year: 'Invalid year.',
      tankL: 'Invalid tank.',
      driverId: 'Inactive driver.',
      vin: 'Duplicate VIN.',
    });
    expect(vehicleFieldErrors(new Error('Network unavailable.'))).toEqual({});
  });
});
