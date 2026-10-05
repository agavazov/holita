import { createContext, useContext } from 'react';
import { themePresets, type ThemeMode, type ThemePreset } from './config.js';
import { COLOR_GROUPS } from './primaryColorOverride.js';

export type Appearance = { preset: ThemePreset; mode: ThemeMode; primaryColor: string | null };
export const defaultAppearance: Appearance = {
  preset: 'default-light',
  mode: 'light',
  primaryColor: null,
};
export const appearanceStorageKey = 'holita.appearance';

export function readAppearance(): Appearance {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(appearanceStorageKey) ?? 'null');
    if (!raw || typeof raw !== 'object') return defaultAppearance;
    const preset = 'preset' in raw ? themePresets.find((value) => value === raw.preset) : undefined;
    const mode =
      'mode' in raw && (raw.mode === 'light' || raw.mode === 'dark' || raw.mode === 'system')
        ? raw.mode
        : 'light';
    const primaryColor =
      'primaryColor' in raw
        ? (COLOR_GROUPS.find((group) => group.main === raw.primaryColor)?.main ?? null)
        : null;
    return { preset: preset ?? 'default-light', mode, primaryColor };
  } catch {
    return defaultAppearance;
  }
}

export const AppearanceContext = createContext<{
  appearance: Appearance;
  isDark: boolean;
  setPreset: (preset: ThemePreset) => void;
  setMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: string) => void;
} | null>(null);

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('Appearance controls require AuroraTheme.');
  return context;
}
