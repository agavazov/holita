import type { Language } from '../../i18n/messages';
import { fieldErrors } from '../../ui/forms/field-errors';
import { deviceConfigurationText } from './device-operations/i18n/messages';
import { devicesText } from './devices/i18n/messages';
import { driversText } from './drivers/i18n/messages';
import { fleetValidationText } from './i18n/messages';
import { maintenanceText } from './maintenance/i18n/messages';
import { settingsText } from './settings/i18n/messages';
import { vehiclesText } from './vehicles/i18n/messages';

/** Fleet reason codes retain their meaning before API paths become editor field names. */
export function fleetFieldErrors<F extends string>(
  error: unknown,
  fields: readonly F[],
  language: Language = 'en',
): Partial<Record<F, string>> {
  const text = fleetValidationText(language);
  return fieldErrors(error, fields, language, (code, path) => {
    switch (code) {
      case 'ALREADY_EXISTS':
        switch (path) {
          case 'fleetNumber':
            return vehiclesText(language).drawer.duplicateFleetNumber;
          case 'vin':
            return vehiclesText(language).drawer.duplicateVin;
          case 'employeeNumber':
            return driversText(language).drawer.duplicateEmployeeNo;
          case 'identificationKey':
            return driversText(language).drawer.duplicateIdentificationKey;
          case 'imei':
            return devicesText(language).drawer.duplicateImei;
          case 'name':
            return settingsText(language).groups.drawer.duplicateName;
          default:
            return text.alreadyExists;
        }
      case 'DRIVER_ASSIGNED':
        return path === 'currentDriverId'
          ? vehiclesText(language).drawer.inactiveDriver
          : driversText(language).drawer.assignedDriver;
      case 'DRIVER_UNAVAILABLE':
        return text.driverUnavailable;
      case 'VEHICLE_UNAVAILABLE':
        return path === 'nextDueOn' || path === 'nextDueOdometerKm'
          ? maintenanceText(language).completion.inactiveNext
          : text.vehicleUnavailable;
      case 'GROUP_UNAVAILABLE':
        return text.groupUnavailable;
      case 'MODEL_REQUIRED':
        return text.modelRequired;
      case 'MODEL_OPTIONS_UNSUPPORTED':
        return text.modelOptionsUnsupported;
      case 'FUTURE_NOT_ALLOWED':
        return text.futureNotAllowed;
      case 'INVALID_TRANSITION':
        return text.invalidTransition;
      case 'DUE_THRESHOLD_REQUIRED':
        return text.dueThresholdRequired;
      case 'ODOMETER_DECREASE':
        return path === 'completedOdometerKm'
          ? maintenanceText(language).completion.earlierOdometerError
          : vehiclesText(language).odometer.lowerReading;
      case 'READING_NOT_LATER':
        return vehiclesText(language).odometer.earlierReading;
      case 'READING_AFTER_LATEST_DATA':
        return vehiclesText(language).odometer.futureReading;
      case 'NEXT_DUE_NOT_LATER':
        return path === 'nextDueOn'
          ? maintenanceText(language).completion.nextDateError
          : maintenanceText(language).completion.nextOdometerError;
      case 'CONFIGURATION_CAPACITY':
        return text.configurationCapacity;
      case 'CATALOG_PARAMETER_UNSUPPORTED':
        return text.catalogParameterUnsupported;
      case 'VALUE_UNCHANGED':
        return deviceConfigurationText(language).editor.unchanged;
      case 'BOUNDED_PERIOD_REQUIRED':
        return text.boundedPeriodRequired;
      default:
        return undefined;
    }
  });
}
