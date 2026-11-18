import { computed, inject, InjectionToken, signal, type Signal } from '@angular/core';
import { UI_LANGUAGE } from '../ui-language';
import {
  datePickerFormat,
  defaultDateFormat,
  formatDateTime,
  formatUtcInstant,
  type DateFormat,
} from './format';

export interface DisplayPreferences {
  readonly timeZone: string;
  readonly dateFormat: DateFormat;
}

export const defaultDisplayPreferences: DisplayPreferences = {
  timeZone: 'Europe/Sofia',
  dateFormat: defaultDateFormat,
};

export const DISPLAY_PREFERENCES = new InjectionToken<Signal<DisplayPreferences>>(
  'Display preferences',
  {
    providedIn: 'root',
    factory: () => signal(defaultDisplayPreferences).asReadonly(),
  },
);

export function injectDisplayFormat(
  preferences: Signal<DisplayPreferences> = inject(DISPLAY_PREFERENCES),
) {
  const language = inject(UI_LANGUAGE);
  return {
    preferences,
    datePickerFormat: computed(() => datePickerFormat(preferences().dateFormat)),
    dateTime: (value: string | null | undefined, seconds = false) =>
      formatDateTime(value, language(), preferences().timeZone, seconds, preferences().dateFormat),
    utc: formatUtcInstant,
  };
}
