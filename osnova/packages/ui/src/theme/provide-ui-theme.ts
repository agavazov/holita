import type { EnvironmentProviders } from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { tabListPt } from '../ui/tabs';
import { uiPreset } from './ui-preset';
import type { ThemeChoice } from './theme-choice';

/**
 * PrimeNG emits its tokens and component styles into the `primeng` layer, between the global
 * reset and the application layer (declared first in `styles/_layers.scss`).
 */
const uiThemeOptions = {
  darkModeSelector: '.app-dark',
  cssLayer: { name: 'primeng', order: 'osnova-reset, primeng, osnova' },
} as const;

export function uiTheme(choice: ThemeChoice) {
  return { preset: uiPreset(choice), options: uiThemeOptions };
}

/**
 * PrimeNG with the UI preset for one design choice; the license is optional. Table cells do
 * not wrap, so a table may scroll sideways: its scroll container is a tab stop for keyboard users.
 */
export function provideOsnovaTheme(choice: ThemeChoice, license?: string): EnvironmentProviders {
  return providePrimeNG({
    ripple: false,
    theme: uiTheme(choice),
    pt: { table: { tableContainer: { tabindex: '0' } }, tabList: tabListPt },
    ...(license ? { license } : {}),
  });
}
