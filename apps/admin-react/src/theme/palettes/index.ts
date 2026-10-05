import { type PaletteOptions } from '@mui/material';
import { type ThemePreset } from '../config.js';
import { arcticPalette } from './arctic.js';
import { darkPalette, lightPalette } from './base.js';
import { draculaPalette } from './dracula.js';
import { emberPalette } from './ember.js';
import { luxuryPalette } from './luxury.js';
import { midnightPalette } from './midnight.js';
import { naturePalette } from './nature.js';
import { retroPalette } from './retro.js';

export const THEME_DISPLAY_NAMES: Partial<Record<ThemePreset, string>> = {
  'default-light': 'Light',
  'default-dark': 'Dark',
  luxury: 'Luxury',
  retro: 'Retro',
  arctic: 'Arctic',
  nature: 'Nature',
  ember: 'Ember',
  dracula: 'Dracula',
  midnight: 'Midnight',
};

export const lightPalettes: Partial<Record<ThemePreset, PaletteOptions>> = {
  'default-light': lightPalette,
  luxury: luxuryPalette,
  retro: retroPalette,
  arctic: arcticPalette,
  nature: naturePalette,
};

export const darkPalettes: Partial<Record<ThemePreset, PaletteOptions>> = {
  'default-dark': darkPalette,
  ember: emberPalette,
  dracula: draculaPalette,
  midnight: midnightPalette,
};

export const allPalettes = {
  'default-light': lightPalette,
  'default-dark': darkPalette,
  luxury: luxuryPalette,
  retro: retroPalette,
  arctic: arcticPalette,
  nature: naturePalette,
  ember: emberPalette,
  dracula: draculaPalette,
  midnight: midnightPalette,
} satisfies Record<ThemePreset, PaletteOptions>;
