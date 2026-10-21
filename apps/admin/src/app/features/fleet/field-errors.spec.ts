import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { Language } from '../../i18n/messages';
import { uiMessages } from '../../ui/i18n/messages';
import { deviceConfigurationText } from './device-operations/i18n/messages';
import { devicesText } from './devices/i18n/messages';
import { driverFieldErrors } from './drivers/driver-mapping';
import { driversText } from './drivers/i18n/messages';
import { fleetFieldErrors } from './field-errors';
import { fleetValidationText } from './i18n/messages';
import { maintenanceText } from './maintenance/i18n/messages';
import { serviceCompletionFieldErrors } from './maintenance/service-task-mapping';
import { generalSettingsFieldErrors } from './settings/general-settings-mapping';
import { settingsText } from './settings/i18n/messages';
import { vehiclesText } from './vehicles/i18n/messages';
import { vehicleFieldErrors } from './vehicles/vehicle-mapping';

function failure(path: string, code: string) {
  return new CombinedGraphQLErrors({
    errors: [
      {
        message: 'English compatibility banner.',
        extensions: {
          code: 'BAD_USER_INPUT',
          fieldErrors: [
            {
              path,
              code,
              message: 'The same English compatibility text for every reason.',
            },
          ],
        },
      },
    ],
  });
}

const languages: readonly Language[] = ['bg', 'en'];

describe('Fleet server validation reasons', () => {
  it.each([
    {
      code: 'ALREADY_EXISTS',
      path: 'fleetNumber',
      text: (language: Language) => vehiclesText(language).drawer.duplicateFleetNumber,
    },
    {
      code: 'ALREADY_EXISTS',
      path: 'vin',
      text: (language: Language) => vehiclesText(language).drawer.duplicateVin,
    },
    {
      code: 'ALREADY_EXISTS',
      path: 'employeeNumber',
      text: (language: Language) => driversText(language).drawer.duplicateEmployeeNo,
    },
    {
      code: 'ALREADY_EXISTS',
      path: 'identificationKey',
      text: (language: Language) => driversText(language).drawer.duplicateIdentificationKey,
    },
    {
      code: 'ALREADY_EXISTS',
      path: 'imei',
      text: (language: Language) => devicesText(language).drawer.duplicateImei,
    },
    {
      code: 'ALREADY_EXISTS',
      path: 'name',
      text: (language: Language) => settingsText(language).groups.drawer.duplicateName,
    },
    {
      code: 'DRIVER_ASSIGNED',
      path: 'currentDriverId',
      text: (language: Language) => vehiclesText(language).drawer.inactiveDriver,
    },
    {
      code: 'DRIVER_ASSIGNED',
      path: 'status',
      text: (language: Language) => driversText(language).drawer.assignedDriver,
    },
    {
      code: 'DRIVER_UNAVAILABLE',
      path: 'currentDriverId',
      text: (language: Language) => fleetValidationText(language).driverUnavailable,
    },
    {
      code: 'VEHICLE_UNAVAILABLE',
      path: 'vehicleId',
      text: (language: Language) => fleetValidationText(language).vehicleUnavailable,
    },
    {
      code: 'VEHICLE_UNAVAILABLE',
      path: 'nextDueOn',
      text: (language: Language) => maintenanceText(language).completion.inactiveNext,
    },
    {
      code: 'GROUP_UNAVAILABLE',
      path: 'groupId',
      text: (language: Language) => fleetValidationText(language).groupUnavailable,
    },
    {
      code: 'MODEL_REQUIRED',
      path: 'options',
      text: (language: Language) => fleetValidationText(language).modelRequired,
    },
    {
      code: 'MODEL_OPTIONS_UNSUPPORTED',
      path: 'options',
      text: (language: Language) => fleetValidationText(language).modelOptionsUnsupported,
    },
    {
      code: 'FUTURE_NOT_ALLOWED',
      path: 'installedAt',
      text: (language: Language) => fleetValidationText(language).futureNotAllowed,
    },
    {
      code: 'INVALID_TRANSITION',
      path: 'expectedStatus',
      text: (language: Language) => fleetValidationText(language).invalidTransition,
    },
    {
      code: 'DUE_THRESHOLD_REQUIRED',
      path: 'dueOn',
      text: (language: Language) => fleetValidationText(language).dueThresholdRequired,
    },
    {
      code: 'ODOMETER_DECREASE',
      path: 'odometerKm',
      text: (language: Language) => vehiclesText(language).odometer.lowerReading,
    },
    {
      code: 'ODOMETER_DECREASE',
      path: 'completedOdometerKm',
      text: (language: Language) => maintenanceText(language).completion.earlierOdometerError,
    },
    {
      code: 'READING_NOT_LATER',
      path: 'recordedAt',
      text: (language: Language) => vehiclesText(language).odometer.earlierReading,
    },
    {
      code: 'READING_AFTER_LATEST_DATA',
      path: 'recordedAt',
      text: (language: Language) => vehiclesText(language).odometer.futureReading,
    },
    {
      code: 'NEXT_DUE_NOT_LATER',
      path: 'nextDueOn',
      text: (language: Language) => maintenanceText(language).completion.nextDateError,
    },
    {
      code: 'NEXT_DUE_NOT_LATER',
      path: 'nextDueOdometerKm',
      text: (language: Language) => maintenanceText(language).completion.nextOdometerError,
    },
    {
      code: 'CONFIGURATION_CAPACITY',
      path: 'parameterId',
      text: (language: Language) => fleetValidationText(language).configurationCapacity,
    },
    {
      code: 'CATALOG_PARAMETER_UNSUPPORTED',
      path: 'parameterId',
      text: (language: Language) => fleetValidationText(language).catalogParameterUnsupported,
    },
    {
      code: 'VALUE_UNCHANGED',
      path: 'intervalSeconds',
      text: (language: Language) => deviceConfigurationText(language).editor.unchanged,
    },
    {
      code: 'BOUNDED_PERIOD_REQUIRED',
      path: 'filter',
      text: (language: Language) => fleetValidationText(language).boundedPeriodRequired,
    },
  ])('localizes $code on $path before editor aliases', ({ code, path, text }) => {
    for (const language of languages) {
      expect(fleetFieldErrors(failure(path, code), [path], language)).toEqual({
        [path]: text(language),
      });
    }
  });

  it('keeps assignment and uniqueness reasons distinct on actual remapped editor fields', () => {
    for (const language of languages) {
      expect(vehicleFieldErrors(failure('currentDriverId', 'DRIVER_ASSIGNED'), language)).toEqual({
        driverId: vehiclesText(language).drawer.inactiveDriver,
      });
      expect(
        vehicleFieldErrors(failure('currentDriverId', 'DRIVER_UNAVAILABLE'), language),
      ).toEqual({
        driverId: fleetValidationText(language).driverUnavailable,
      });
      expect(driverFieldErrors(failure('employeeNumber', 'ALREADY_EXISTS'), language)).toEqual({
        employeeNo: driversText(language).drawer.duplicateEmployeeNo,
      });
    }
  });

  it('preserves different server-specific next-service reasons on the same field', () => {
    for (const language of languages) {
      expect(
        serviceCompletionFieldErrors(failure('nextDueOn', 'VEHICLE_UNAVAILABLE'), language),
      ).toEqual({
        nextDueOn: maintenanceText(language).completion.inactiveNext,
      });
      expect(
        serviceCompletionFieldErrors(failure('nextDueOn', 'NEXT_DUE_NOT_LATER'), language),
      ).toEqual({
        nextDueOn: maintenanceText(language).completion.nextDateError,
      });
    }
  });

  it('localizes the Core Branch name through the neutral settings mapper', () => {
    for (const language of languages) {
      expect(generalSettingsFieldErrors(failure('name', 'REQUIRED'), language)).toEqual({
        name: uiMessages[language].validation.required,
      });
      expect(generalSettingsFieldErrors(failure('name', 'TOO_LONG'), language)).toEqual({
        name: uiMessages[language].validation.tooLong,
      });
      expect(generalSettingsFieldErrors(failure('name', 'FUTURE_REASON_2'), language)).toEqual({
        name: uiMessages[language].validation.invalid,
      });
    }
  });
});
