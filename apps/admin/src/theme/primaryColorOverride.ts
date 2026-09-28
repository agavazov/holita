import { type PaletteOptions } from '@mui/material/styles';
import { generatePaletteChannel } from './utils.js';
import {
  arcticPrimary,
  draculaPrimary,
  emberPrimary,
  luxuryPrimary,
  midnightPrimary,
  naturePrimary,
  primaryRetro,
} from './colors/index.js';
import { blue } from './colors/base.js';
import type { ThemePreset } from './config.js';
type Shades = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;

const createLightModeMapping = (shades: Shades, mainColor: string): Record<string, string> => ({
  lighter: shades[50],
  light: shades[400],
  main: mainColor,
  dark: shades[600],
  darker: shades[900],
  contrastText: shades[50],
});

const createDarkModeMapping = (shades: Shades, mainColor: string): Record<string, string> => ({
  lighter: shades[950],
  light: shades[700],
  main: mainColor,
  dark: shades[300],
  darker: shades[100],
  contrastText: shades[950],
});

const createInvertedChBlue = (shades: Shades): Record<string, string> => ({
  50: shades[950],
  100: shades[800],
  200: shades[700],
  300: shades[600],
  400: shades[500],
  500: shades[400],
  600: shades[300],
  700: shades[200],
  800: shades[100],
  900: shades[50],
  950: '#ffffff',
});

export interface ColorGroup {
  key: ThemePreset;
  main: string;
  palette: Shades;
}

export const COLOR_GROUPS: ColorGroup[] = [
  { key: 'default-light', main: blue[500], palette: blue },
  { key: 'default-dark', main: blue[400], palette: blue },
  { key: 'retro', main: primaryRetro[500], palette: primaryRetro },
  { key: 'luxury', main: luxuryPrimary[500], palette: luxuryPrimary },
  { key: 'arctic', main: arcticPrimary[500], palette: arcticPrimary },
  { key: 'nature', main: naturePrimary[500], palette: naturePrimary },
  { key: 'ember', main: emberPrimary[400], palette: emberPrimary },
  { key: 'dracula', main: draculaPrimary[400], palette: draculaPrimary },
  { key: 'midnight', main: midnightPrimary[400], palette: midnightPrimary },
];

export const applyPrimaryOverride = (
  basePalette: PaletteOptions | undefined,
  primaryColor: string | null | undefined,
  mode: 'light' | 'dark' = 'light',
): PaletteOptions | undefined => {
  if (!primaryColor) return basePalette;
  const colorGroup = COLOR_GROUPS.find((group) => group.main === primaryColor);
  if (!colorGroup?.palette) return basePalette;

  const newPrimary =
    mode === 'dark'
      ? generatePaletteChannel({
          ...createDarkModeMapping(colorGroup.palette, primaryColor),
        })
      : generatePaletteChannel({
          ...createLightModeMapping(colorGroup.palette, primaryColor),
        });

  const newChBlue =
    mode === 'dark'
      ? generatePaletteChannel(createInvertedChBlue(colorGroup.palette))
      : generatePaletteChannel(colorGroup.palette);

  return {
    ...basePalette,
    primary: newPrimary,
    chBlue: newChBlue,
  };
};
