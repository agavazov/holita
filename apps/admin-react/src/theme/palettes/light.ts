import { type PaletteOptions, alpha } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from '../utils.js';
import {
  basic,
  blue,
  grey as colorGrey,
  green,
  lightBlue,
  orange,
  purple,
  red,
} from '../colors/base.js';

export const lightPaletteMainColors = {
  primary: blue[500],
  secondary: purple[500],
  error: red[500],
  warning: orange[500],
  success: green[500],
  info: lightBlue[500],
  neutral: colorGrey[800],
  paper: basic.white,
  textPrimary: colorGrey[800],
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(colorGrey);

const lightPrimary = generatePaletteChannel({
  lighter: blue[50],
  light: blue[400],
  main: blue[500],
  dark: blue[600],
  darker: blue[900],
  contrastText: common.white,
});
const lightSecondary = generatePaletteChannel({
  lighter: purple[50],
  light: purple[300],
  main: purple[500],
  dark: purple[700],
  darker: purple[900],
  contrastText: common.white,
});
const lightError = generatePaletteChannel({
  lighter: red[50],
  light: red[300],
  main: red[500],
  dark: red[600],
  darker: red[900],
});
const lightWarning = generatePaletteChannel({
  lighter: orange[50],
  light: orange[400],
  main: orange[500],
  dark: orange[700],
  darker: orange[900],
  contrastText: common.white,
});
const lightSuccess = generatePaletteChannel({
  lighter: green[50],
  light: green[400],
  main: green[500],
  dark: green[700],
  darker: green[900],
});
const lightInfo = generatePaletteChannel({
  lighter: lightBlue[50],
  light: lightBlue[300],
  main: lightBlue[500],
  dark: lightBlue[700],
  darker: lightBlue[900],
  contrastText: common.white,
});
const lightNeutral = generatePaletteChannel({
  lighter: grey[100],
  light: grey[600],
  main: grey[800],
  dark: grey[900],
  darker: grey[950],
  contrastText: common.white,
});

const lightAction = generatePaletteChannel({
  active: grey[500],
  hover: grey[100],
  selected: grey[100],
  disabled: grey[400],
  disabledBackground: grey[200],
  focus: grey[300],
});
const lightDivider = grey[300];
const lightMenuDivider = cssVarRgba(grey['700Channel'], 0);
const lightDividerLight = cssVarRgba(grey['300Channel'], 0.6);
const lightText = generatePaletteChannel({
  primary: grey[800],
  secondary: grey[600],
  disabled: grey[400],
});
const lightBackground = generatePaletteChannel({
  elevation1: grey[50],
  elevation2: grey[100],
  elevation3: grey[200],
  elevation4: grey[300],
  menu: basic.white,
  menuElevation1: grey[50],
  menuElevation2: grey[100],
});
const lightVibrant = {
  listItemHover: cssVarRgba(common.whiteChannel, 0.5),
  buttonHover: cssVarRgba(common.whiteChannel, 0.7),
  textFieldHover: cssVarRgba(common.whiteChannel, 0.7),
  text: {
    secondary: alpha('#1B150F', 0.76),
    disabled: alpha('#1B150F', 0.4),
  },
  overlay: cssVarRgba(common.whiteChannel, 0.7),
};
const lightChGrey = grey;
const lightChRed = generatePaletteChannel(red);
const lightChBlue = generatePaletteChannel(blue);
const lightChGreen = generatePaletteChannel(green);
const lightChOrange = generatePaletteChannel(orange);
const lightChLightBlue = generatePaletteChannel(lightBlue);
const lightChPurple = generatePaletteChannel(purple);

export const lightPalette = {
  common,
  grey,
  primary: lightPrimary,
  secondary: lightSecondary,
  error: lightError,
  warning: lightWarning,
  success: lightSuccess,
  info: lightInfo,
  neutral: lightNeutral,
  action: lightAction,
  divider: lightDivider,
  dividerLight: lightDividerLight,
  menuDivider: lightMenuDivider,
  text: lightText,
  background: lightBackground,
  vibrant: lightVibrant,
  chGrey: lightChGrey,
  chRed: lightChRed,
  chBlue: lightChBlue,
  chGreen: lightChGreen,
  chOrange: lightChOrange,
  chLightBlue: lightChLightBlue,
  chPurple: lightChPurple,
} satisfies PaletteOptions;
