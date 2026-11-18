import { InjectionToken } from '@angular/core';

export const SHELL_STORAGE_KEY = new InjectionToken<string>('Shell storage key', {
  factory: () => 'osnova.ui.sidebar',
});
