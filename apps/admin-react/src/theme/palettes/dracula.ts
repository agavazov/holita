import { type PaletteOptions } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from '../utils.js';
import { basic } from '../colors/base.js';
import {
  draculaError,
  draculaInfo,
  draculaNeutral,
  draculaPrimary,
  draculaSecondary,
  draculaSuccess,
  draculaWarning,
} from '../colors/dracula.js';

export const draculaPaletteMainColors = {
  primary: draculaPrimary[400],
  secondary: draculaSecondary[400],
  error: draculaError[400],
  warning: draculaWarning[400],
  success: draculaSuccess[400],
  info: draculaInfo[400],
  neutral: draculaNeutral[300],
  paper: draculaNeutral[950],
  textPrimary: draculaNeutral[100],
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(draculaNeutral);

const neutral = generatePaletteChannel({
  lighter: grey[900],
  light: grey[800],
  main: grey[300],
  dark: grey[200],
  darker: grey[100],
  contrastText: grey[950],
});
const primary = generatePaletteChannel({
  lighter: draculaPrimary[950],
  light: draculaPrimary[700],
  main: draculaPrimary[400],
  dark: draculaPrimary[300],
  darker: draculaPrimary[100],
  contrastText: draculaPrimary[950],
});
const secondary = generatePaletteChannel({
  lighter: draculaSecondary[950],
  light: draculaSecondary[700],
  main: draculaSecondary[400],
  dark: draculaSecondary[300],
  darker: draculaSecondary[100],
  contrastText: draculaSecondary[950],
});
const error = generatePaletteChannel({
  lighter: draculaError[950],
  light: draculaError[600],
  main: draculaError[400],
  dark: draculaError[300],
  darker: draculaError[200],
  contrastText: draculaError[950],
});
const warning = generatePaletteChannel({
  lighter: draculaWarning[950],
  light: draculaWarning[800],
  main: draculaWarning[400],
  dark: draculaWarning[300],
  darker: draculaWarning[200],
  contrastText: draculaWarning[950],
});
const success = generatePaletteChannel({
  lighter: draculaSuccess[950],
  light: draculaSuccess[700],
  main: draculaSuccess[400],
  dark: draculaSuccess[300],
  darker: draculaSuccess[200],
  contrastText: draculaSuccess[950],
});
const info = generatePaletteChannel({
  lighter: draculaInfo[950],
  light: draculaInfo[700],
  main: draculaInfo[400],
  dark: draculaInfo[300],
  darker: draculaInfo[200],
  contrastText: draculaInfo[950],
});

const action = generatePaletteChannel({
  active: grey[500],
  hover: grey[700],
  selected: grey[900],
  disabled: grey[500],
  disabledBackground: grey[700],
  focus: grey[700],
});

const divider = grey[700];
const menuDivider = grey[700];
const dividerLight = grey[800];
const text = generatePaletteChannel({
  primary: grey[100],
  secondary: grey[400],
  disabled: grey[500],
});

const background = generatePaletteChannel({
  default: grey[950],
  paper: grey[950],
  elevation1: grey[900],
  elevation2: grey[800],
  elevation3: grey[700],
  elevation4: grey[600],
  menu: grey[900],
  menuElevation1: grey[800],
  menuElevation2: grey[700],
});
const vibrant = {
  listItemHover: cssVarRgba(common.whiteChannel, 0.1),
  buttonHover: cssVarRgba(common.whiteChannel, 0.1),
  textFieldHover: cssVarRgba(common.whiteChannel, 0.1),
  text: {
    secondary: cssVarRgba(common.whiteChannel, 0.7),
    disabled: cssVarRgba(common.whiteChannel, 0.5),
  },
  overlay: cssVarRgba(common.whiteChannel, 0),
};

const chGrey = generatePaletteChannel({
  50: grey[900],
  100: grey[800],
  200: grey[700],
  300: grey[600],
  400: grey[500],
  500: grey[400],
  600: grey[300],
  700: grey[200],
  800: grey[100],
  900: grey[50],
  950: common.white,
});
const chRed = generatePaletteChannel({
  50: draculaError[950],
  100: draculaError[800],
  200: draculaError[700],
  300: draculaError[600],
  400: draculaError[500],
  500: draculaError[400],
  600: draculaError[300],
  700: draculaError[200],
  800: draculaError[100],
  900: draculaError[50],
  950: common.white,
});
const chBlue = generatePaletteChannel({
  50: draculaPrimary[950],
  100: draculaPrimary[800],
  200: draculaPrimary[700],
  300: draculaPrimary[600],
  400: draculaPrimary[500],
  500: draculaPrimary[400],
  600: draculaPrimary[300],
  700: draculaPrimary[200],
  800: draculaPrimary[100],
  900: draculaPrimary[50],
  950: common.white,
});
const chGreen = generatePaletteChannel({
  50: draculaSuccess[950],
  100: draculaSuccess[800],
  200: draculaSuccess[700],
  300: draculaSuccess[600],
  400: draculaSuccess[500],
  500: draculaSuccess[400],
  600: draculaSuccess[300],
  700: draculaSuccess[200],
  800: draculaSuccess[100],
  900: draculaSuccess[50],
  950: common.white,
});
const chOrange = generatePaletteChannel({
  50: draculaWarning[950],
  100: draculaWarning[800],
  200: draculaWarning[700],
  300: draculaWarning[600],
  400: draculaWarning[500],
  500: draculaWarning[400],
  600: draculaWarning[300],
  700: draculaWarning[200],
  800: draculaWarning[100],
  900: draculaWarning[50],
  950: common.white,
});
const chLightBlue = generatePaletteChannel({
  50: draculaInfo[950],
  100: draculaInfo[800],
  200: draculaInfo[700],
  300: draculaInfo[600],
  400: draculaInfo[500],
  500: draculaInfo[400],
  600: draculaInfo[300],
  700: draculaInfo[200],
  800: draculaInfo[100],
  900: draculaInfo[50],
  950: common.white,
});
const chPurple = generatePaletteChannel({
  50: draculaSecondary[950],
  100: draculaSecondary[800],
  200: draculaSecondary[700],
  300: draculaSecondary[600],
  400: draculaSecondary[500],
  500: draculaSecondary[400],
  600: draculaSecondary[300],
  700: draculaSecondary[200],
  800: draculaSecondary[100],
  900: draculaSecondary[50],
  950: common.white,
});

export const draculaPalette = {
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
