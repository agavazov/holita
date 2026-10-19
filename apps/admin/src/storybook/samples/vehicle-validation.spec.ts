import { vehiclesText } from '../../app/features/fleet/vehicles/i18n/messages';
import { sampleNow, sampleVehicles } from './fleet-samples';
import { sampleFuelStatus, vehicleForm } from './rows';
import { vehicleFormErrors } from './vehicle-validation';

const [vehicle, other] = sampleVehicles;
if (!vehicle || !other) throw new Error('Missing sample vehicles.');
const text = vehiclesText('en').drawer;

describe('sample vehicle contracts', () => {
  it('permits a shared plate while enforcing the actual fleet number and VIN uniqueness', () => {
    const form = { ...vehicleForm(vehicle), plate: other.plate, fleetNumber: '', vin: '' };
    expect(vehicleFormErrors(sampleVehicles, vehicle.id, form, text)).toEqual({});
    expect(
      vehicleFormErrors(
        sampleVehicles,
        vehicle.id,
        {
          ...form,
          fleetNumber: other.fleetNumber,
          vin: other.vin,
        },
        text,
      ),
    ).toEqual({ fleetNumber: text.duplicateFleetNumber, vin: text.duplicateVin });
  });

  it('requires unassignment for a status edit to INACTIVE', () => {
    const form = { ...vehicleForm(vehicle), status: 'INACTIVE' as const, driverId: 'd01' };
    expect(vehicleFormErrors(sampleVehicles, vehicle.id, form, text)).toEqual({
      driverId: text.inactiveDriver,
    });
    expect(
      vehicleFormErrors(sampleVehicles, vehicle.id, { ...form, driverId: null }, text),
    ).toEqual({});
  });

  it('preserves unknown specification values', () => {
    expect(vehicleForm({ ...vehicle, year: null, type: null, fuelType: null })).toMatchObject({
      year: null,
      type: null,
      fuelType: null,
    });
  });

  it('counts only fresh low fuel, including the exact six-hour boundary', () => {
    const low = {
      ...vehicle,
      fuelPct: 8,
      lastReportedAt: new Date(sampleNow - 6 * 3_600_000).toISOString(),
    };
    expect(sampleFuelStatus(low)).toBe('LOW');
    expect(
      sampleFuelStatus({
        ...low,
        lastReportedAt: new Date(sampleNow - 6 * 3_600_000 - 1).toISOString(),
      }),
    ).toBe('STALE');
    expect(sampleFuelStatus({ ...low, fuelPct: null })).toBe('NO_DATA');
  });
});
