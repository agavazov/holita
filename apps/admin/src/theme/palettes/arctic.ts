import { type PaletteOptions, alpha } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from '../utils.js';
import {
  arcticError,
  arcticInfo,
  arcticNeutral,
  arcticPrimary,
  arcticSecondary,
  arcticSuccess,
  arcticWarning,
} from '../colors/arctic.js';
import { basic } from '../colors/base.js';

export const arcticPaletteMainColors = {
  primary: arcticPrimary[500],
  secondary: arcticSecondary[500],
  error: arcticError[500],
  warning: arcticWarning[500],
  success: arcticSuccess[500],
  info: arcticInfo[500],
  neutral: arcticNeutral[800],
  paper: '#F1F9FB',
  textPrimary: arcticNeutral[800],
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(arcticNeutral);

const primary = generatePaletteChannel({
  lighter: arcticPrimary[50],
  light: arcticPrimary[400],
  main: arcticPrimary[500],
  dark: arcticPrimary[600],
  darker: arcticPrimary[900],
  contrastText: arcticSecondary[50],
});

const secondary = generatePaletteChannel({
  lighter: arcticSecondary[50],
  light: arcticSecondary[300],
  main: arcticSecondary[500],
  dark: arcticSecondary[700],
  darker: arcticSecondary[900],
  contrastText: arcticSecondary[50],
});

const error = generatePaletteChannel({
  lighter: arcticError[50],
  light: arcticError[300],
  main: arcticError[500],
  dark: arcticError[600],
  darker: arcticError[900],
  contrastText: arcticError[50],
});

const warning = generatePaletteChannel({
  lighter: arcticWarning[50],
  light: arcticWarning[400],
  main: arcticWarning[500],
  dark: arcticWarning[700],
  darker: arcticWarning[900],
  contrastText: arcticWarning[50],
});

const success = generatePaletteChannel({
  lighter: arcticSuccess[50],
  light: arcticSuccess[400],
  main: arcticSuccess[500],
  dark: arcticSuccess[700],
  darker: arcticSuccess[900],
  contrastText: arcticSuccess[50],
});

const info = generatePaletteChannel({
  lighter: arcticInfo[50],
  light: arcticInfo[300],
  main: arcticInfo[500],
  dark: arcticInfo[700],
  darker: arcticInfo[900],
  contrastText: arcticInfo[50],
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
  default: '#F1F9FB',
  paper: '#F1F9FB',
  elevation1: grey[50],
  elevation2: grey[100],
  elevation3: grey[200],
  elevation4: grey[300],
  menu: '#F1F9FB',
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

const chRed = generatePaletteChannel(arcticError);
const chBlue = generatePaletteChannel(arcticPrimary);
const chGreen = generatePaletteChannel(arcticSuccess);
const chOrange = generatePaletteChannel(arcticWarning);
const chLightBlue = generatePaletteChannel(arcticInfo);
const chPurple = generatePaletteChannel(arcticSecondary);

export const arcticPalette = {
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
