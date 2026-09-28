export const themePresets = [
  'default-light',
  'default-dark',
  'luxury',
  'retro',
  'arctic',
  'nature',
  'ember',
  'dracula',
  'midnight',
] as const;
export type ThemePreset = (typeof themePresets)[number];
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontFamily = 'Plus Jakarta Sans';
export const initialConfig = { fontFamily: 'Plus Jakarta Sans' as const };
