import { type PaletteOptions, alpha } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from '../utils.js';
import { basic } from '../colors/base.js';
import {
  errorRetro,
  infoRetro,
  neutralRetro,
  primaryRetro,
  secondaryRetro,
  successRetro,
  warningRetro,
} from '../colors/retro.js';

export const retroPaletteMainColors = {
  primary: primaryRetro[500],
  secondary: secondaryRetro[500],
  error: errorRetro[500],
  warning: warningRetro[500],
  success: successRetro[500],
  info: infoRetro[500],
  neutral: neutralRetro[800],
  paper: '#F1E7CF',
  textPrimary: neutralRetro[800],
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(neutralRetro);

const primary = generatePaletteChannel({
  lighter: primaryRetro[50],
  light: primaryRetro[400],
  main: primaryRetro[500],
  dark: primaryRetro[600],
  darker: primaryRetro[900],
  contrastText: primaryRetro[50],
});

const secondary = generatePaletteChannel({
  lighter: secondaryRetro[50],
  light: secondaryRetro[300],
  main: secondaryRetro[500],
  dark: secondaryRetro[700],
  darker: secondaryRetro[900],
  contrastText: secondaryRetro[50],
});

const error = generatePaletteChannel({
  lighter: errorRetro[50],
  light: errorRetro[300],
  main: errorRetro[500],
  dark: errorRetro[600],
  darker: errorRetro[900],
  contrastText: errorRetro[50],
});

const warning = generatePaletteChannel({
  lighter: warningRetro[50],
  light: warningRetro[400],
  main: warningRetro[500],
  dark: warningRetro[700],
  darker: warningRetro[900],
  contrastText: warningRetro[50],
});

const success = generatePaletteChannel({
  lighter: successRetro[50],
  light: successRetro[400],
  main: successRetro[500],
  dark: successRetro[700],
  darker: successRetro[900],
  contrastText: successRetro[50],
});

const info = generatePaletteChannel({
  lighter: infoRetro[50],
  light: infoRetro[300],
  main: infoRetro[500],
  dark: infoRetro[700],
  darker: infoRetro[900],
  contrastText: infoRetro[50],
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
  default: '#F1E7CF',
  paper: '#F1E7CF',
  elevation1: grey[50],
  elevation2: grey[100],
  elevation3: grey[200],
  elevation4: grey[300],
  menu: '#F1E7CF',
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
const chRed = generatePaletteChannel(errorRetro);
const chBlue = generatePaletteChannel(primaryRetro);
const chGreen = generatePaletteChannel(successRetro);
const chOrange = generatePaletteChannel(warningRetro);
const chLightBlue = generatePaletteChannel(infoRetro);
const chPurple = generatePaletteChannel(secondaryRetro);

export const retroPalette = {
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
