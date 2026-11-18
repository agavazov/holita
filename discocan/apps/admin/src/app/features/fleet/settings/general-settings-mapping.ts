import type { Language } from '../../../i18n/messages';
import type {
  AdminFleetSettingsFragment,
  UpdateFleetSettingsInput,
} from '../../../../generated/graphql/operations';
import { fieldErrors } from '../../../ui/forms/field-errors';
import type { GeneralSettings, GeneralSettingsField } from './general-settings-view';

export const generalSettingsFields = [
  'name',
  'timeZone',
  'dateFormat',
  'notificationRetentionDays',
  'distanceUnit',
  'volumeUnit',
  'lowFuelPct',
  'notReportingHours',
  'speedLimitKph',
] as const satisfies readonly GeneralSettingsField[];

export function generalSettingsForm(
  settings: AdminFleetSettingsFragment,
  name: string,
): GeneralSettings {
  return {
    name,
    timeZone: settings.timeZone,
    dateFormat: settings.dateFormat,
    notificationRetentionDays: settings.notificationRetentionDays,
    distanceUnit: settings.distanceUnit === 'MI' ? 'mi' : 'km',
    volumeUnit: settings.volumeUnit === 'US_GALLON' ? 'gal' : 'l',
    lowFuelPct: settings.lowFuelPct,
    notReportingHours: settings.notReportingHours,
    speedLimitKph: settings.speedLimitKph,
  };
}

export function generalSettingsInput(form: GeneralSettings): UpdateFleetSettingsInput {
  return {
    timeZone: form.timeZone,
    dateFormat: form.dateFormat,
    notificationRetentionDays: form.notificationRetentionDays,
    distanceUnit: form.distanceUnit === 'mi' ? 'MI' : 'KM',
    volumeUnit: form.volumeUnit === 'gal' ? 'US_GALLON' : 'LITRE',
    lowFuelPct: form.lowFuelPct,
    notReportingHours: form.notReportingHours,
    speedLimitKph: form.speedLimitKph,
  };
}

export function generalSettingsFieldErrors(
  error: unknown,
  language: Language = 'en',
): Partial<Record<GeneralSettingsField, string>> {
  return fieldErrors(error, generalSettingsFields, language);
}
