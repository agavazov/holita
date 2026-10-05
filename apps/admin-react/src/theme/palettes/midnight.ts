import { type PaletteOptions } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from '../utils.js';
import { basic } from '../colors/base.js';
import {
  midnightBg,
  midnightError,
  midnightInfo,
  midnightNeutral,
  midnightPrimary,
  midnightSecondary,
  midnightSuccess,
  midnightWarning,
} from '../colors/midnight.js';

export const midnightPaletteMainColors = {
  primary: midnightPrimary[400],
  secondary: midnightSecondary[400],
  error: midnightError[400],
  warning: midnightWarning[400],
  success: midnightSuccess[400],
  info: midnightInfo[400],
  neutral: midnightNeutral[300],
  paper: midnightBg.dark,
  textPrimary: midnightNeutral[100],
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(midnightNeutral);

const neutral = generatePaletteChannel({
  lighter: grey[900],
  light: grey[800],
  main: grey[300],
  dark: grey[200],
  darker: grey[100],
  contrastText: grey[950],
});

const primary = generatePaletteChannel({
  lighter: midnightPrimary[950],
  light: midnightPrimary[700],
  main: midnightPrimary[400],
  dark: midnightPrimary[300],
  darker: midnightPrimary[100],
  contrastText: midnightPrimary[950],
});

const secondary = generatePaletteChannel({
  lighter: midnightSecondary[950],
  light: midnightSecondary[700],
  main: midnightSecondary[400],
  dark: midnightSecondary[300],
  darker: midnightSecondary[100],
  contrastText: midnightSecondary[950],
});

const error = generatePaletteChannel({
  lighter: midnightError[950],
  light: midnightError[600],
  main: midnightError[400],
  dark: midnightError[300],
  darker: midnightError[200],
  contrastText: midnightError[950],
});

const warning = generatePaletteChannel({
  lighter: midnightWarning[950],
  light: midnightWarning[800],
  main: midnightWarning[400],
  dark: midnightWarning[300],
  darker: midnightWarning[200],
  contrastText: midnightWarning[950],
});

const success = generatePaletteChannel({
  lighter: midnightSuccess[950],
  light: midnightSuccess[700],
  main: midnightSuccess[400],
  dark: midnightSuccess[300],
  darker: midnightSuccess[200],
  contrastText: midnightSuccess[950],
});

const info = generatePaletteChannel({
  lighter: midnightInfo[950],
  light: midnightInfo[700],
  main: midnightInfo[400],
  dark: midnightInfo[300],
  darker: midnightInfo[200],
  contrastText: midnightInfo[950],
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
  50: midnightError[950],
  100: midnightError[800],
  200: midnightError[700],
  300: midnightError[600],
  400: midnightError[500],
  500: midnightError[400],
  600: midnightError[300],
  700: midnightError[200],
  800: midnightError[100],
  900: midnightError[50],
  950: common.white,
});

const chBlue = generatePaletteChannel({
  50: midnightPrimary[950],
  100: midnightPrimary[800],
  200: midnightPrimary[700],
  300: midnightPrimary[600],
  400: midnightPrimary[500],
  500: midnightPrimary[400],
  600: midnightPrimary[300],
  700: midnightPrimary[200],
  800: midnightPrimary[100],
  900: midnightPrimary[50],
  950: common.white,
});

const chGreen = generatePaletteChannel({
  50: midnightSuccess[950],
  100: midnightSuccess[800],
  200: midnightSuccess[700],
  300: midnightSuccess[600],
  400: midnightSuccess[500],
  500: midnightSuccess[400],
  600: midnightSuccess[300],
  700: midnightSuccess[200],
  800: midnightSuccess[100],
  900: midnightSuccess[50],
  950: common.white,
});

const chOrange = generatePaletteChannel({
  50: midnightWarning[950],
  100: midnightWarning[800],
  200: midnightWarning[700],
  300: midnightWarning[600],
  400: midnightWarning[500],
  500: midnightWarning[400],
  600: midnightWarning[300],
  700: midnightWarning[200],
  800: midnightWarning[100],
  900: midnightWarning[50],
  950: common.white,
});

const chLightBlue = generatePaletteChannel({
  50: midnightInfo[950],
  100: midnightInfo[800],
  200: midnightInfo[700],
  300: midnightInfo[600],
  400: midnightInfo[500],
  500: midnightInfo[400],
  600: midnightInfo[300],
  700: midnightInfo[200],
  800: midnightInfo[100],
  900: midnightInfo[50],
  950: common.white,
});

const chPurple = generatePaletteChannel({
  50: midnightSecondary[950],
  100: midnightSecondary[800],
  200: midnightSecondary[700],
  300: midnightSecondary[600],
  400: midnightSecondary[500],
  500: midnightSecondary[400],
  600: midnightSecondary[300],
  700: midnightSecondary[200],
  800: midnightSecondary[100],
  900: midnightSecondary[50],
  950: common.white,
});

export const midnightPalette = {
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
