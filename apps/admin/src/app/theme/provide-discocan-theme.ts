import type { EnvironmentProviders } from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { tabListPt } from '../ui/tabs';
import { discocanPreset } from './discocan-preset';
import type { ThemeChoice } from './theme-choice';

/**
 * PrimeNG emits its tokens and component styles into the `primeng` layer, between the global
 * reset and the discocan layer (declared first in `styles/_layers.scss`).
 */
const discocanThemeOptions = {
  darkModeSelector: '.app-dark',
  cssLayer: { name: 'primeng', order: 'discocan-reset, primeng, discocan' },
} as const;

export function discocanTheme(choice: ThemeChoice) {
  return { preset: discocanPreset(choice), options: discocanThemeOptions };
}

/**
 * PrimeNG with the discocan preset for one design choice; the license is optional. Table cells do
 * not wrap, so a table may scroll sideways: its scroll container is a tab stop for keyboard users.
 */
export function provideDiscoCanTheme(choice: ThemeChoice, license?: string): EnvironmentProviders {
  return providePrimeNG({
    ripple: false,
    theme: discocanTheme(choice),
    pt: { table: { tableContainer: { tabindex: '0' } }, tabList: tabListPt },
    ...(license ? { license } : {}),
  });
}
