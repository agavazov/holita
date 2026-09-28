import { type TypographyVariantsOptions } from '@mui/material/styles';
import { type FontFamily, initialConfig } from './config.js';

const createTypography = (
  fontFamily: FontFamily = initialConfig.fontFamily,
  fontSize: number = 16,
): TypographyVariantsOptions => ({
  fontFamily: [fontFamily, 'sans-serif', 'Spline Sans Mono', 'monospace', 'Josefin Sans'].join(','),
  fontSize,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightSemiBold: 600,
  fontWeightBold: 700,
  h1: {
    fontWeight: 700,
    fontSize: '3rem', // 48px
    lineHeight: 1.5,
  },
  h2: {
    fontWeight: 700,
    fontSize: '2.625rem', // 42px
    lineHeight: 1.5,
  },
  h3: {
    fontWeight: 700,
    fontSize: '2rem', // 32px
    lineHeight: 1.5,
  },
  h4: {
    fontWeight: 700,
    fontSize: '1.75rem', // 28px
    lineHeight: 1.5,
  },
  h5: {
    fontWeight: 700,
    fontSize: '1.5rem', // 24px
    lineHeight: 1.5,
  },
  h6: {
    fontWeight: 700,
    fontSize: '1.3125rem', // 21px
    lineHeight: 1.4,
  },
  subtitle1: {
    fontWeight: 400,
    fontSize: '1rem', // 16px
    lineHeight: 1.3,
  },
  subtitle2: {
    fontWeight: 500,
    fontSize: '0.875rem', // 14px
    lineHeight: 1.3,
  },
  body1: {
    fontWeight: 400,
    fontSize: '1rem', // 16px
    lineHeight: 1.6,
  },
  body2: {
    fontWeight: 400,
    fontSize: '0.875rem', // 14px
    lineHeight: 1.6,
  },
  button: {
    fontWeight: 700,
    fontSize: '0.875rem', // 14px
    lineHeight: 1.286,
    textTransform: 'capitalize',
  },
  caption: {
    fontWeight: 400,
    fontSize: '0.75rem', // 12px
    lineHeight: 1.2,
  },
  overline: {
    fontWeight: 400,
    fontSize: '0.75rem', // 12px
    lineHeight: 1.2,
    textTransform: 'uppercase',
  },
});

export default createTypography;
