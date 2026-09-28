import { type PaletteOptions, alpha } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from '../utils.js';
import { basic } from '../colors/base.js';
import {
  luxuryError,
  luxuryInfo,
  luxuryNeutral,
  luxuryPrimary,
  luxurySecondary,
  luxurySuccess,
  luxuryWarning,
} from '../colors/luxury.js';

export const luxuryPaletteMainColors = {
  primary: luxuryPrimary[500],
  secondary: luxurySecondary[500],
  error: luxuryError[500],
  warning: luxuryWarning[500],
  success: luxurySuccess[500],
  info: luxuryInfo[500],
  neutral: luxuryNeutral[800],
  paper: '#FDFBFB',
  textPrimary: luxuryNeutral[800],
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(luxuryNeutral);

const primary = generatePaletteChannel({
  lighter: luxuryPrimary[50],
  light: luxuryPrimary[400],
  main: luxuryPrimary[500],
  dark: luxuryPrimary[600],
  darker: luxuryPrimary[900],
  contrastText: luxurySecondary[50],
});

const secondary = generatePaletteChannel({
  lighter: luxurySecondary[50],
  light: luxurySecondary[300],
  main: luxurySecondary[500],
  dark: luxurySecondary[700],
  darker: luxurySecondary[900],
  contrastText: luxurySecondary[50],
});

const error = generatePaletteChannel({
  lighter: luxuryError[50],
  light: luxuryError[300],
  main: luxuryError[500],
  dark: luxuryError[600],
  darker: luxuryError[900],
  contrastText: luxuryError[50],
});

const warning = generatePaletteChannel({
  lighter: luxuryWarning[50],
  light: luxuryWarning[400],
  main: luxuryWarning[500],
  dark: luxuryWarning[700],
  darker: luxuryWarning[900],
  contrastText: luxuryWarning[50],
});

const success = generatePaletteChannel({
  lighter: luxurySuccess[50],
  light: luxurySuccess[400],
  main: luxurySuccess[500],
  dark: luxurySuccess[700],
  darker: luxurySuccess[900],
  contrastText: luxurySuccess[50],
});

const info = generatePaletteChannel({
  lighter: luxuryInfo[50],
  light: luxuryInfo[300],
  main: luxuryInfo[500],
  dark: luxuryInfo[700],
  darker: luxuryInfo[900],
  contrastText: luxuryInfo[50],
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
  default: '#FDFBFB',
  paper: '#FDFBFB',
  elevation1: grey[50],
  elevation2: grey[100],
  elevation3: grey[200],
  elevation4: grey[300],
  menu: '#FDFBFB',
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
const chRed = generatePaletteChannel(luxuryError);
const chBlue = generatePaletteChannel(luxuryPrimary);
const chGreen = generatePaletteChannel(luxurySuccess);
const chOrange = generatePaletteChannel(luxuryWarning);
const chLightBlue = generatePaletteChannel(luxuryInfo);
const chPurple = generatePaletteChannel(luxurySecondary);

export const luxuryPalette = {
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
