import type { EnvironmentProviders } from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { holitaPreset } from './holita-preset';
import type { ThemeChoice } from './theme-choice';

/**
 * PrimeNG emits its tokens and component styles into the `primeng` layer, between the global
 * reset and the holita layer (declared first in `styles/_layers.scss`).
 */
export const holitaThemeOptions = {
  darkModeSelector: '.app-dark',
  cssLayer: { name: 'primeng', order: 'holita-reset, primeng, holita' },
} as const;

export function holitaTheme(choice: ThemeChoice) {
  return { preset: holitaPreset(choice), options: holitaThemeOptions };
}

/** PrimeNG with the holita preset for one design choice; the license is optional. */
export function provideHolitaTheme(choice: ThemeChoice, license?: string): EnvironmentProviders {
  return providePrimeNG({
    ripple: false,
    theme: holitaTheme(choice),
    ...(license ? { license } : {}),
  });
}
