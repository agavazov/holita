import { computed, inject, InjectionToken, signal, type Signal } from '@angular/core';
import type { Language } from '../../i18n/messages';
import type { AdminFleetSettingsFragment } from '../../../generated/graphql/operations';
import { UI_LANGUAGE } from '../ui-language';
import { uiMessages } from '../i18n/messages';
import {
  datePickerFormat,
  defaultDateFormat,
  formatDateOnly,
  formatDateRange,
  formatDateTime,
  formatDateTimeCell,
  formatDateTimeRange,
  formatNumber,
  formatTime,
  formatUtcInstant,
} from './format';

export type FleetDisplayPreferences = Readonly<
  Pick<
    AdminFleetSettingsFragment,
    'timeZone' | 'dateFormat' | 'distanceUnit' | 'volumeUnit' | 'lowFuelPct' | 'notReportingHours'
  >
>;

export const defaultFleetDisplay: FleetDisplayPreferences = {
  timeZone: 'Europe/Sofia',
  dateFormat: defaultDateFormat,
  distanceUnit: 'KM',
  volumeUnit: 'LITRE',
  lowFuelPct: 12,
  notReportingHours: 48,
};

/** Overridden by one verified Fleet workspace; standalone examples retain the metric defaults. */
export const FLEET_DISPLAY = new InjectionToken<Signal<FleetDisplayPreferences>>('Fleet display', {
  factory: () => signal(defaultFleetDisplay).asReadonly(),
});

const kilometresPerMile = 1.609344;
const litresPerUsGallon = 3.785411784;

export function distanceValue(value: number | null, unit: FleetDisplayPreferences['distanceUnit']) {
  return value === null ? null : unit === 'MI' ? value / kilometresPerMile : value;
}

function volumeValue(value: number | null, unit: FleetDisplayPreferences['volumeUnit']) {
  return value === null ? null : unit === 'US_GALLON' ? value / litresPerUsGallon : value;
}

/** Display conversions; an editor accepting these units converts back to its canonical API units. */
export function injectFleetFormat(
  preferences: Signal<FleetDisplayPreferences> = inject(FLEET_DISPLAY),
  language: Signal<Language> = inject(UI_LANGUAGE),
) {
  const distanceUnit = computed(
    () => uiMessages[language()].units[preferences().distanceUnit === 'MI' ? 'mi' : 'km'],
  );
  const speedUnit = computed(
    () => uiMessages[language()].units[preferences().distanceUnit === 'MI' ? 'mph' : 'kmh'],
  );
  const volumeUnit = computed(
    () =>
      uiMessages[language()].units[preferences().volumeUnit === 'US_GALLON' ? 'gallon' : 'litre'],
  );
  function distance(value: number | null, withUnit = true, fraction = 1): string {
    const result = formatNumber(distanceValue(value, preferences().distanceUnit), language(), {
      fraction,
    });
    return value === null || !withUnit ? result : `${result}\u00a0${distanceUnit()}`;
  }
  function speed(value: number | null, withUnit = true, fraction = 0): string {
    const result = formatNumber(distanceValue(value, preferences().distanceUnit), language(), {
      fraction,
    });
    return value === null || !withUnit ? result : `${result}\u00a0${speedUnit()}`;
  }
  function volume(value: number | null, withUnit = true, fraction = 1): string {
    const result = formatNumber(volumeValue(value, preferences().volumeUnit), language(), {
      fraction,
    });
    return value === null || !withUnit ? result : `${result}\u00a0${volumeUnit()}`;
  }
  return {
    preferences,
    datePickerFormat: computed(() => datePickerFormat(preferences().dateFormat)),
    dateTime: (value: string | null | undefined, seconds = false) =>
      formatDateTime(value, language(), preferences().timeZone, seconds, preferences().dateFormat),
    dateOnly: (value: string | null | undefined) =>
      formatDateOnly(value, language(), preferences().dateFormat),
    dateRange: (from: string | null | undefined, to: string | null | undefined) =>
      formatDateRange(from, to, language(), preferences().dateFormat),
    dateTimeRange: (
      from: string | null | undefined,
      to: string | null | undefined,
      seconds = false,
    ) =>
      formatDateTimeRange(
        from,
        to,
        language(),
        preferences().timeZone,
        seconds,
        preferences().dateFormat,
      ),
    dateTimeCell: (value: string | null | undefined, seconds = false) =>
      formatDateTimeCell(
        value,
        language(),
        preferences().timeZone,
        seconds,
        preferences().dateFormat,
      ),
    time: (value: string | null | undefined, timeZone = preferences().timeZone) =>
      formatTime(value, language(), timeZone),
    utc: formatUtcInstant,
    distanceUnit,
    speedUnit,
    volumeUnit,
    distance,
    speed,
    volume,
    distanceValue: (value: number | null) => distanceValue(value, preferences().distanceUnit),
  };
}
