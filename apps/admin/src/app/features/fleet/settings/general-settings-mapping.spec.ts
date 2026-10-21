import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { AdminFleetSettingsFragment } from '../../../../generated/graphql/operations';
import {
  generalSettingsFieldErrors,
  generalSettingsForm,
  generalSettingsInput,
} from './general-settings-mapping';

const settings: AdminFleetSettingsFragment = {
  timeZone: 'Europe/Sofia',
  distanceUnit: 'KM',
  volumeUnit: 'LITRE',
  lowFuelPct: 12,
  notReportingHours: 48,
  speedLimitKph: 90,
};

describe('General settings mapping', () => {
  it('maps stored units and the actual Core name without inventing notification preferences', () => {
    expect(generalSettingsForm(settings, 'Sofia Fleet')).toEqual({
      name: 'Sofia Fleet',
      timeZone: 'Europe/Sofia',
      distanceUnit: 'km',
      volumeUnit: 'l',
      lowFuelPct: 12,
      notReportingHours: 48,
      speedLimitKph: 90,
      criticalAlerts: false,
      dailySummary: false,
      documentReminders: false,
    });
    const form = generalSettingsForm(
      { ...settings, distanceUnit: 'MI', volumeUnit: 'US_GALLON' },
      'Other',
    );
    expect(form.distanceUnit).toBe('mi');
    expect(form.volumeUnit).toBe('gal');
    expect(generalSettingsInput(form)).toEqual({
      ...settings,
      distanceUnit: 'MI',
      volumeUnit: 'US_GALLON',
    });
  });

  it('submits only the six Fleet fields, independently of Branch name and Demo switches', () => {
    expect(
      generalSettingsInput({
        ...generalSettingsForm(settings, 'Renamed'),
        criticalAlerts: true,
        dailySummary: true,
        documentReminders: true,
        lowFuelPct: 1,
      }),
    ).toEqual({ ...settings, lowFuelPct: 1 });
  });

  it('keeps known Core and Fleet field errors and ignores unrelated paths', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Invalid input',
          extensions: {
            fieldErrors: [
              { path: 'name', message: 'Invalid Branch name.' },
              { path: 'lowFuelPct', message: 'Invalid threshold.' },
              { path: 'criticalAlerts', message: 'No provider.' },
              { path: 'unknown', message: 'Ignored.' },
            ],
          },
        },
      ],
    });
    expect(generalSettingsFieldErrors(error)).toEqual({
      name: 'The value is not valid.',
      lowFuelPct: 'The value is not valid.',
    });
  });
});
