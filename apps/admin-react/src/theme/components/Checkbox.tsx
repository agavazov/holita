import {
  type Theme,
  checkboxClasses,
  formControlLabelClasses,
  svgIconClasses,
} from '@mui/material';
import { type Components } from '@mui/material/styles';
import { cssVarRgba } from '../utils.js';
import CheckBoxBlankIcon from './CheckBoxBlankIcon.js';
import CheckBoxCheckedIcon from './CheckBoxCheckedIcon.js';
import CheckBoxIndeterminateIcon from './CheckBoxIndeterminateIcon.js';

const colors = ['primary', 'secondary', 'info', 'success', 'warning', 'error'] as const;

const Checkbox: Components<Omit<Theme, 'components'>>['MuiCheckbox'] = {
  variants: [
    ...colors.map((color) => ({
      props: { color: color },
      style: (style: { theme: Theme }) => {
        const theme = style.theme;
        const paletteColor = theme.vars.palette[color];

        return {
          '&:hover': {
            background: cssVarRgba(paletteColor.mainChannel, 0.12),
          },
        };
      },
    })),
    {
      props: { color: 'default' },
      style: (style) => {
        const theme = style.theme;

        return {
          '&:hover': {
            background: theme.vars.palette.background.elevation2,
          },
        };
      },
    },
  ],
  defaultProps: {
    size: 'small',
    icon: <CheckBoxBlankIcon className="checkbox-blank-icon" viewBox="0 0 16 16" />,
    checkedIcon: <CheckBoxCheckedIcon viewBox="0 0 16 16" />,
    indeterminateIcon: <CheckBoxIndeterminateIcon viewBox="0 0 16 16" />,
  },
  styleOverrides: {
    root: ({ theme }) => ({
      [`.${svgIconClasses.fontSizeMedium}`]: {
        fontSize: 20,
      },
      [`.${svgIconClasses.fontSizeSmall}`]: {
        fontSize: 16,
      },
      [`.${svgIconClasses.fontSizeLarge}`]: {
        fontSize: 24,
      },
      [`&.${checkboxClasses.disabled}`]: {
        '& .checkbox-blank-icon': { color: theme.vars.palette.background.elevation3 },
        [`&.${checkboxClasses.checked}`]: {
          color: theme.vars.palette.text.disabled,
        },
        [`&:not(.${checkboxClasses.checked})`]: {
          [`& .${svgIconClasses.root}`]: {
            color: theme.vars.palette.background.elevation3,
          },
        },
      },
      [`&.MuiCheckbox-sizeLarge`]: {
        [`+.${formControlLabelClasses.label}`]: {
          marginTop: 9,
        },
      },
      '& .checkbox-blank-icon': {
        color: theme.vars.palette.background.elevation4,
      },
    }),
    sizeMedium: {
      [`+.${formControlLabelClasses.label}`]: {
        marginTop: 7,
      },
    },
    sizeSmall: {
      [`+.${formControlLabelClasses.label}`]: {
        marginTop: 5,
      },
    },
  },
};
export default Checkbox;
