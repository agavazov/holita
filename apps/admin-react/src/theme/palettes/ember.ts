import { type PaletteOptions } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from '../utils.js';
import { basic } from '../colors/base.js';
import {
  emberError,
  emberInfo,
  emberNeutral,
  emberPrimary,
  emberSecondary,
  emberSuccess,
  emberWarning,
} from '../colors/ember.js';

export const emberPaletteMainColors = {
  primary: emberPrimary[400],
  secondary: emberSecondary[400],
  error: emberError[400],
  warning: emberWarning[400],
  success: emberSuccess[400],
  info: emberInfo[400],
  neutral: emberNeutral[300],
  paper: emberNeutral[950],
  textPrimary: emberNeutral[100],
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(emberNeutral);

const neutral = generatePaletteChannel({
  lighter: grey[900],
  light: grey[800],
  main: grey[300],
  dark: grey[200],
  darker: grey[100],
  contrastText: grey[950],
});
const primary = generatePaletteChannel({
  lighter: emberPrimary[950],
  light: emberPrimary[700],
  main: emberPrimary[400],
  dark: emberPrimary[300],
  darker: emberPrimary[100],
  contrastText: emberPrimary[950],
});
const secondary = generatePaletteChannel({
  lighter: emberSecondary[950],
  light: emberSecondary[700],
  main: emberSecondary[400],
  dark: emberSecondary[300],
  darker: emberSecondary[100],
  contrastText: emberSecondary[950],
});
const error = generatePaletteChannel({
  lighter: emberError[950],
  light: emberError[600],
  main: emberError[400],
  dark: emberError[300],
  darker: emberError[200],
  contrastText: emberError[950],
});
const warning = generatePaletteChannel({
  lighter: emberWarning[950],
  light: emberWarning[800],
  main: emberWarning[400],
  dark: emberWarning[300],
  darker: emberWarning[200],
  contrastText: emberWarning[950],
});
const success = generatePaletteChannel({
  lighter: emberSuccess[950],
  light: emberSuccess[700],
  main: emberSuccess[400],
  dark: emberSuccess[300],
  darker: emberSuccess[200],
  contrastText: emberSuccess[950],
});
const info = generatePaletteChannel({
  lighter: emberInfo[950],
  light: emberInfo[700],
  main: emberInfo[400],
  dark: emberInfo[300],
  darker: emberInfo[200],
  contrastText: emberInfo[950],
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
  50: emberError[950],
  100: emberError[800],
  200: emberError[700],
  300: emberError[600],
  400: emberError[500],
  500: emberError[400],
  600: emberError[300],
  700: emberError[200],
  800: emberError[100],
  900: emberError[50],
  950: common.white,
});
const chBlue = generatePaletteChannel({
  50: emberPrimary[950],
  100: emberPrimary[800],
  200: emberPrimary[700],
  300: emberPrimary[600],
  400: emberPrimary[500],
  500: emberPrimary[400],
  600: emberPrimary[300],
  700: emberPrimary[200],
  800: emberPrimary[100],
  900: emberPrimary[50],
  950: common.white,
});
const chGreen = generatePaletteChannel({
  50: emberSuccess[950],
  100: emberSuccess[800],
  200: emberSuccess[700],
  300: emberSuccess[600],
  400: emberSuccess[500],
  500: emberSuccess[400],
  600: emberSuccess[300],
  700: emberSuccess[200],
  800: emberSuccess[100],
  900: emberSuccess[50],
  950: common.white,
});
const chOrange = generatePaletteChannel({
  50: emberWarning[950],
  100: emberWarning[800],
  200: emberWarning[700],
  300: emberWarning[600],
  400: emberWarning[500],
  500: emberWarning[400],
  600: emberWarning[300],
  700: emberWarning[200],
  800: emberWarning[100],
  900: emberWarning[50],
  950: common.white,
});
const chLightBlue = generatePaletteChannel({
  50: emberInfo[950],
  100: emberInfo[800],
  200: emberInfo[700],
  300: emberInfo[600],
  400: emberInfo[500],
  500: emberInfo[400],
  600: emberInfo[300],
  700: emberInfo[200],
  800: emberInfo[100],
  900: emberInfo[50],
  950: common.white,
});
const chPurple = generatePaletteChannel({
  50: emberSecondary[950],
  100: emberSecondary[800],
  200: emberSecondary[700],
  300: emberSecondary[600],
  400: emberSecondary[500],
  500: emberSecondary[400],
  600: emberSecondary[300],
  700: emberSecondary[200],
  800: emberSecondary[100],
  900: emberSecondary[50],
  950: common.white,
});

export const emberPalette = {
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
