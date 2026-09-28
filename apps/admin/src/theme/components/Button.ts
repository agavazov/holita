import { type ComponentsVariants, type Theme, capitalize } from '@mui/material';
import { buttonClasses } from '@mui/material/Button';
import type { CSSObject, Components } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { cssVarRgba } from '../utils.js';

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    soft: true;
    dashed: true;
  }

  interface ButtonPropsColorOverrides {
    neutral: true;
  }

  interface ButtonClasses {
    outlinedNeutral: true;
  }

  interface ButtonOwnProps {
    shape?: 'square' | 'circle';
  }
}

const btnColors = ['primary', 'secondary', 'info', 'success', 'warning', 'error'] as const;

//Button soft variants
const btnCustomVariants: ComponentsVariants<Theme>['MuiButton'] = btnColors.map((color) => ({
  props: { variant: 'soft', color: color },
  style: (style) => {
    const theme = style.theme;

    return {
      background: cssVarRgba(theme.vars.palette[color].mainChannel, 0.15),
      color: theme.vars.palette[color].dark,
      '&:hover': {
        background: cssVarRgba(theme.vars.palette[color].mainChannel, 0.2),
      },
    };
  },
}));

const shapes = ['circle', 'square'] as const;
const sizes = { small: 30, medium: 36, large: 42 };
const sizeNames = ['small', 'medium', 'large'] as const;

const btnShapeVariants: ComponentsVariants<Theme>['MuiButton'] = [];

shapes.forEach((shape) => {
  sizeNames.forEach((size) => {
    btnShapeVariants.push({
      props: { shape, size },
      style: {
        height: sizes[size],
        minWidth: sizes[size],
        padding: 0,
        borderRadius: shape === 'circle' ? '50%' : undefined,
      },
    });
  });
});

const outlineStyles = (theme: Theme) =>
  btnColors.reduce<Record<string, CSSObject>>((acc, color) => {
    const paletteColor = theme.vars.palette[color];

    acc[`&.${buttonClasses.outlined}.MuiButton-color${capitalize(color)}`] = {
      '&:hover': {
        backgroundColor: cssVarRgba(paletteColor.mainChannel, 0.12),
        borderColor: cssVarRgba(paletteColor.mainChannel, 0.5),
      },
    };

    return acc;
  }, {});

const textBtnStyles = (theme: Theme) =>
  btnColors.reduce<Record<string, CSSObject>>((acc, color) => {
    const paletteColor = theme.vars.palette[color];

    acc[`&.${buttonClasses.text}.MuiButton-color${capitalize(color)}`] = {
      '&:hover': {
        backgroundColor: cssVarRgba(paletteColor.mainChannel, 0.12),
      },
    };

    return acc;
  }, {});

const Button: Components<Omit<Theme, 'components'>>['MuiButton'] = {
  variants: [
    ...btnCustomVariants,
    ...btnShapeVariants,
    {
      props: { variant: 'outlined', color: 'neutral' },
      style: (style) => {
        const theme = style.theme;

        return {
          borderColor: theme.vars.palette.background.elevation4,
          '&:hover': {
            backgroundColor: theme.vars.palette.background.elevation2,
          },
        };
      },
    },
    {
      props: { variant: 'soft', color: 'neutral' },
      style: (style) => {
        const theme = style.theme;

        return {
          background: theme.vars.palette.background.elevation2,
          color: theme.vars.palette.neutral.main,
          '&:hover': {
            background: theme.vars.palette.background.elevation3,
          },
          ...theme.applyStyles('dark', {
            color: theme.vars.palette.neutral.dark,
          }),
        };
      },
    },
  ],
  defaultProps: {
    disableElevation: true,
  },
  styleOverrides: {
    root: ({ theme }) => ({
      textTransform: 'none',
      fontSize: '14px',
      fontWeight: 600,
      borderRadius: '8px',
      padding: theme.spacing(1, 2),
      lineHeight: 1.429,
      [`&.${buttonClasses.outlined}.${buttonClasses.sizeLarge}`]: {
        paddingTop: '9px',
        paddingBottom: '9px',
      },
      [`&.${buttonClasses.outlined}.${buttonClasses.sizeMedium}`]: {
        paddingTop: '7px',
        paddingBottom: '7px',
      },
      [`&.${buttonClasses.outlined}.${buttonClasses.sizeSmall}`]: {
        paddingTop: '5px',
        paddingBottom: '5px',
      },
      [`&.${buttonClasses.sizeLarge} > .${buttonClasses.icon}`]: {
        fontSize: 16,
      },
      ...outlineStyles(theme),
      ...textBtnStyles(theme),
    }),
    sizeLarge: {
      fontSize: '16px',
      padding: '10px 22px',
      lineHeight: 1.375,
    },
    sizeSmall: {
      padding: '6px 10px',
      lineHeight: 1.286,
    },
    startIcon: {
      marginRight: 4,
      '& > *:first-of-type': {
        fontSize: 16,
      },
    },
    endIcon: {
      marginLeft: 4,
      '& > *:first-of-type': {
        fontSize: 16,
      },
    },
  },
};

export const ButtonBase: Components<Omit<Theme, 'components'>>['MuiButtonBase'] = {
  defaultProps: {},
};
export default Button;
