import { type PaletteOptions, alpha } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from '../utils.js';
import { basic } from '../colors/base.js';
import {
  natureError,
  natureInfo,
  natureNeutral,
  naturePrimary,
  natureSecondary,
  natureSuccess,
  natureWarning,
} from '../colors/nature.js';

export const naturePaletteMainColors = {
  primary: naturePrimary[500],
  secondary: natureSecondary[500],
  error: natureError[500],
  warning: natureWarning[500],
  success: natureSuccess[500],
  info: natureInfo[500],
  neutral: natureNeutral[600],
  paper: '#FAF6EC',
  textPrimary: natureNeutral[800],
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(natureNeutral);

const primary = generatePaletteChannel({
  lighter: naturePrimary[50],
  light: naturePrimary[400],
  main: naturePrimary[500],
  dark: naturePrimary[600],
  darker: naturePrimary[900],
  contrastText: natureSecondary[50],
});

const secondary = generatePaletteChannel({
  lighter: natureSecondary[50],
  light: natureSecondary[300],
  main: natureSecondary[500],
  dark: natureSecondary[700],
  darker: natureSecondary[900],
  contrastText: natureSecondary[50],
});

const error = generatePaletteChannel({
  lighter: natureError[50],
  light: natureError[300],
  main: natureError[500],
  dark: natureError[600],
  darker: natureError[900],
  contrastText: natureError[50],
});

const warning = generatePaletteChannel({
  lighter: natureWarning[50],
  light: natureWarning[400],
  main: natureWarning[500],
  dark: natureWarning[700],
  darker: natureWarning[900],
  contrastText: natureWarning[50],
});

const success = generatePaletteChannel({
  lighter: natureSuccess[50],
  light: natureSuccess[400],
  main: natureSuccess[500],
  dark: natureSuccess[700],
  darker: natureSuccess[900],
  contrastText: natureSuccess[50],
});

const info = generatePaletteChannel({
  lighter: natureInfo[50],
  light: natureInfo[300],
  main: natureInfo[500],
  dark: natureInfo[700],
  darker: natureInfo[900],
  contrastText: natureInfo[50],
});

const neutral = generatePaletteChannel({
  lighter: grey[100],
  light: grey[600],
  main: grey[800],
  dark: grey[900],
  darker: grey[950],
  contrastText: grey[50],
});

const action = generatePaletteChannel({
  active: grey[500],
  hover: grey[100],
  selected: grey[100],
  disabled: grey[400],
  disabledBackground: grey[200],
  focus: grey[300],
});

const divider = grey[300];
const menuDivider = cssVarRgba(grey['700Channel'], 0);
const dividerLight = cssVarRgba(grey['300Channel'], 0.6);

const text = generatePaletteChannel({
  primary: grey[800],
  secondary: grey[600],
  disabled: grey[400],
});

const background = generatePaletteChannel({
  default: '#FAF6EC',
  paper: '#FAF6EC',
  elevation1: grey[50],
  elevation2: grey[100],
  elevation3: grey[200],
  elevation4: grey[300],
  menu: '#FAF6EC',
  menuElevation1: grey[50],
  menuElevation2: grey[100],
});

const vibrant = {
  listItemHover: cssVarRgba(common.whiteChannel, 0.5),
  buttonHover: cssVarRgba(common.whiteChannel, 0.7),
  textFieldHover: cssVarRgba(common.whiteChannel, 0.7),
  text: {
    secondary: alpha('#1B150F', 0.76),
    disabled: alpha('#1B150F', 0.4),
  },
  overlay: cssVarRgba(common.whiteChannel, 0.7),
};

const chGrey = grey;
const chRed = generatePaletteChannel(natureError);
const chBlue = generatePaletteChannel(naturePrimary);
const chGreen = generatePaletteChannel(natureSuccess);
const chOrange = generatePaletteChannel(natureWarning);
const chLightBlue = generatePaletteChannel(natureInfo);
const chPurple = generatePaletteChannel(natureSecondary);

export const naturePalette = {
  common,
  grey,
  primary,
  secondary,
  error,
  warning,
  success,
  info,
  neutral,
  action,
  divider,
  dividerLight,
  menuDivider,
  text,
  background,
  vibrant,
  chGrey,
  chRed,
  chBlue,
  chGreen,
  chOrange,
  chLightBlue,
  chPurple,
} satisfies PaletteOptions;
